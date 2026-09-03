import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"

function writeError(cause: unknown): CompanyOperationError {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (message.includes("organization revision conflict")) {
    return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
  }
  if (message.includes("UNIQUE constraint") || message.includes("request fingerprint")) {
    return new CompanyConflictError(
      "組織変更IDまたは組織コードが競合しています",
      "idempotency_conflict",
    )
  }
  if (message.includes("organization ")) {
    return new CompanyValidationError("組織変更後の状態が不正です", "invalid_change", {
      cause,
    })
  }
  return new CompanyUnavailableError(
    "組織変更を保存できません",
    "organization_change_unavailable",
    { cause },
  )
}

type Context = CompanyContext

type FindCompletedOrganizationUnitChangeProps = Readonly<{
  operationId: string
  requestFingerprint: string
}>

type CompletedOrganizationUnitChange = Readonly<{
  resultingRevision: number
  organizationUnitId: string
}>

export class OrganizationWorkforceChangeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readSnapshot(asOf: Parameters<OrganizationUnitReadAdapter["readSnapshot"]>[0]) {
    return new OrganizationUnitReadAdapter(this.c.var.database).readSnapshot(asOf)
  }

  async find(
    props: FindCompletedOrganizationUnitChangeProps,
  ): Promise<CompletedOrganizationUnitChange | null | CompanyOperationError> {
    try {
      const existing = await this.c.env.DB.prepare(
        `SELECT operation.resulting_revision, operation.status, operation.request_fingerprint,
                period.organization_unit_id
           FROM company_organization_change_operations AS operation
           LEFT JOIN company_organization_unit_period_versions AS period
             ON period.recorded_by_action_id = operation.id
          WHERE operation.id = ?1`,
      )
        .bind(props.operationId)
        .first<{
          resulting_revision: number
          status: "PENDING" | "COMPLETED"
          request_fingerprint: string
          organization_unit_id: string | null
        }>()
      if (existing === null) return null
      if (
        existing.status !== "COMPLETED" ||
        existing.request_fingerprint !== props.requestFingerprint ||
        existing.organization_unit_id === null
      ) {
        return new CompanyConflictError(
          "組織変更IDが別の操作に使われています",
          "idempotency_conflict",
        )
      }
      return {
        resultingRevision: existing.resulting_revision,
        organizationUnitId: existing.organization_unit_id,
      }
    } catch (cause) {
      return writeError(cause)
    }
  }

  async append(
    change: OrganizationWorkforceChangeEntity,
    requestFingerprint: string,
  ): Promise<
    | { resultingRevision: number; organizationUnitId: string; replayed: boolean }
    | CompanyOperationError
  > {
    try {
      const existing = await this.find({ operationId: change.operationId, requestFingerprint })
      if (existing instanceof CompanyOperationError) return existing
      if (existing !== null) return { ...existing, replayed: true }

      const statements: D1PreparedStatement[] = [
        this.c.env.DB.prepare(
          `INSERT INTO company_organization_change_operations
               (id, expected_revision, change_count, applied_count, resulting_revision, status,
                recorded_at, actor_account_id, reason, evidence_references_json,
                request_fingerprint)
             VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', ?4, ?5, ?6, ?7, ?8)`,
        ).bind(
          change.operationId,
          change.expectedRevision,
          change.periodCount,
          change.recordedAt,
          change.actorAccountId,
          change.reason,
          JSON.stringify(change.evidenceReferences),
          requestFingerprint,
        ),
      ]
      for (const identity of change.organizationUnits) {
        statements.push(
          this.c.env.DB.prepare(
            "INSERT INTO company_organization_units (id, created_at) VALUES (?1, ?2)",
          ).bind(identity.id, identity.createdAt),
        )
      }
      for (const period of change.unitPeriods) {
        statements.push(
          this.c.env.DB.prepare(
            `INSERT INTO company_organization_unit_period_versions
                 (period_id, revision, organization_unit_id, code, official_name, kind,
                  parent_organization_unit_id, starts_on, ends_on, is_void,
                  recorded_by_action_id, recorded_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
          ).bind(
            period.periodId,
            period.revision,
            period.organizationUnitId,
            period.code,
            period.officialName,
            period.kind,
            period.parentOrganizationUnitId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt,
          ),
        )
      }
      statements.push(
        this.c.env.DB.prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1 AND status = 'PENDING'",
        ).bind(change.operationId),
      )
      await this.c.env.DB.batch(statements)
      return {
        resultingRevision: change.expectedRevision + change.periodCount,
        organizationUnitId: change.unitPeriods[0]?.organizationUnitId ?? "",
        replayed: false,
      }
    } catch (cause) {
      const raced = await this.find({ operationId: change.operationId, requestFingerprint })
      if (raced !== null && !(raced instanceof CompanyOperationError)) {
        return { ...raced, replayed: true }
      }
      if (raced instanceof CompanyConflictError) return raced
      return writeError(cause)
    }
  }
}
