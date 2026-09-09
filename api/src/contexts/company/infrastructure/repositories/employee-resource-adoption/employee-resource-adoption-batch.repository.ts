import type { EmployeeResourceAdoptionBatchEntity } from "@/contexts/company/domain/entities/employee-resource-adoption-batch.entity"
import type { EmployeeResourceAdoptionEntity } from "@/contexts/company/domain/entities/employee-resource-adoption.entity"
import type { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import {
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
export type EmployeeResourceAdoptionBatchResult = Readonly<{
  employeeIds: ReadonlyArray<string>
  organizationRevision: number
  replayed: boolean
}>
type Confirmed = Readonly<{
  command: EmployeeResourceAdoptionEntity
  snapshot: EmployeeResourceAdoptionSnapshotValue
}>

/** 全員の照合・接続・証跡を同じtransactionで保存し、会社版を一度だけ進める。 */
export class EmployeeResourceAdoptionBatchRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async adopt(
    command: EmployeeResourceAdoptionBatchEntity,
  ): Promise<EmployeeResourceAdoptionBatchResult | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({
      operation: "employee-resource-adoption-batch",
      ...command.props,
      recordedAt: null,
    })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    const snapshots = new EmployeeResourceAdoptionSnapshotAdapter(this.c.env.DB)
    const employeeIds = command.props.employees.map((employee) => employee.employeeId)
    try {
      const replay = await this.replay(command, fingerprint)
      if (replay !== null) return replay
      const today = resolveCompanyBusinessDate({
        now: new Date(command.props.recordedAt).toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (today instanceof Error) return this.unavailable(today)
      if (today !== command.props.observedOn) return this.conflict()
      const sources = await snapshots.findMany(employeeIds)
      if (sources instanceof CompanyValidationError) return sources
      if (sources instanceof Error) return this.unavailable(sources)
      if (sources.length !== employeeIds.length)
        return new CompanyNotFoundError("従業員が見つかりません", "employee_not_found")

      const confirmed: Confirmed[] = []
      for (const [index, snapshot] of sources.entries()) {
        const employee = command.confirm(
          snapshot,
          `employee-adoption-batch:${fingerprint}:${index}`,
        )
        if (employee instanceof Error) return employee
        confirmed.push({ command: employee, snapshot })
      }
      const payloads = this.preparePayloads(confirmed, fingerprint)
      if (payloads instanceof Error) return payloads
      const organizationRevision = command.props.expectedRevision + 1
      await this.c.env.DB.batch([
        ...payloads.map((payload) => snapshots.prepareBatchGuard(payload)),
        this.c.env.DB.prepare(`INSERT INTO company_command_receipts
          (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
          VALUES ('organization:default', ?1, ?2, ?3, ?4, ?5)`).bind(
          `employee-adoption-batch:${command.props.commandId}`,
          fingerprint,
          command.props.expectedRevision,
          organizationRevision,
          command.props.recordedAt,
        ),
        ...payloads.map((payload) => this.prepareBindings(payload)),
        this.c.env.DB.prepare(`UPDATE company_organizations SET revision = ?1, updated_at = ?2
          WHERE id = 'organization:default' AND revision = ?3`).bind(
          organizationRevision,
          command.props.recordedAt,
          command.props.expectedRevision,
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END",
        ),
        ...payloads.map((payload) => this.prepareReceipts(payload)),
      ])
      return { employeeIds, organizationRevision, replayed: false }
    } catch (cause) {
      try {
        const replay = await this.replay(command, fingerprint)
        if (replay !== null) return replay
        const current = await snapshots.findMany(employeeIds)
        if (
          !(current instanceof Error) &&
          (current.length !== employeeIds.length ||
            current.some(
              (snapshot) =>
                command.props.employees.find(
                  (employee) => employee.employeeId === snapshot.props.value.employee.id,
                )?.snapshotDigest !== snapshot.props.digest,
            ))
        )
          return this.conflict()
      } catch {
        return this.unavailable(cause)
      }
      return this.unavailable(cause)
    }
  }

  private preparePayloads(
    confirmed: ReadonlyArray<Confirmed>,
    fingerprint: string,
  ): ReadonlyArray<string> | CompanyValidationError {
    const chunks: Array<{ rows: string[]; bytes: number }> = [{ rows: [], bytes: 2 }]
    const size = { total: 0 }
    for (const entry of confirmed) {
      const latest = new Map<string, (typeof entry.command.props.resources)[number]>()
      for (const resource of entry.command.props.resources) {
        if (resource.type !== "person") latest.set(`${resource.type}:${resource.id}`, resource)
      }
      const row = JSON.stringify({
        commandId: entry.command.props.commandId,
        employeeId: entry.command.props.employeeId,
        fingerprint,
        actorAccountId: entry.command.props.actorAccountId,
        reason: entry.command.props.reason,
        expectedRevision: entry.command.props.expectedRevision,
        organizationRevision: entry.command.props.expectedRevision + 1,
        observedOn: entry.command.props.observedOn,
        snapshotDigest: entry.snapshot.props.digest,
        sourceJson: entry.snapshot.props.sourceJson,
        recordedAt: entry.command.props.recordedAt,
        lifecycleRevision: entry.snapshot.props.value.lifecycleRevision,
        bindings: [...latest.values()].map((resource) => ({
          type: resource.type,
          id: resource.id,
          revision: resource.revision,
        })),
      })
      const bytes = new TextEncoder().encode(row).length + 1
      size.total += bytes
      if (bytes + 2 > 1_750_000 || size.total > 8_000_000) return this.tooLarge()
      if (chunks[chunks.length - 1]!.bytes + bytes > 1_750_000) chunks.push({ rows: [], bytes: 2 })
      const chunk = chunks[chunks.length - 1]!
      chunk.rows.push(row)
      chunk.bytes += bytes
    }
    // 各chunkは照合・接続・証跡の3文。同じbatch内で33文以下に収める。
    if (chunks.length > 10) return this.tooLarge()
    const payloads = chunks.map((chunk) => `[${chunk.rows.join(",")}]`)
    if (
      payloads.reduce((total, payload) => total + new TextEncoder().encode(payload).length, 0) >
      8_000_000
    )
      return this.tooLarge()
    return payloads
  }

  private prepareBindings(payload: string): D1PreparedStatement {
    return this.c.env.DB.prepare(`INSERT INTO company_workforce_resource_bindings
      (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
      SELECT json_extract(binding.value, '$.type'), json_extract(binding.value, '$.id'),
        'organization:default', json_extract(employee.value, '$.employeeId'),
        json_extract(binding.value, '$.revision'), json_extract(employee.value, '$.lifecycleRevision'), NULL
      FROM json_each(?1) AS employee, json_each(employee.value, '$.bindings') AS binding
      ORDER BY json_extract(binding.value, '$.type'), json_extract(binding.value, '$.id')`).bind(
      payload,
    )
  }

  private prepareReceipts(payload: string): D1PreparedStatement {
    return this.c.env.DB.prepare(`INSERT INTO company_employee_resource_adoptions
      (command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision,
       observed_on, snapshot_digest, source_json, recorded_at)
      SELECT json_extract(value, '$.commandId'), json_extract(value, '$.employeeId'),
        json_extract(value, '$.fingerprint'), json_extract(value, '$.actorAccountId'),
        json_extract(value, '$.reason'), json_extract(value, '$.expectedRevision'),
        json_extract(value, '$.organizationRevision'), json_extract(value, '$.observedOn'),
        json_extract(value, '$.snapshotDigest'), json_extract(value, '$.sourceJson'),
        json_extract(value, '$.recordedAt') FROM json_each(?1)`).bind(payload)
  }

  private async replay(
    command: EmployeeResourceAdoptionBatchEntity,
    fingerprint: string,
  ): Promise<EmployeeResourceAdoptionBatchResult | CompanyConflictError | null> {
    const row =
      await this.c.env.DB.prepare(`SELECT fingerprint, organization_revision FROM company_command_receipts
      WHERE organization_id = 'organization:default' AND command_id = ?1`)
        .bind(`employee-adoption-batch:${command.props.commandId}`)
        .first()
    if (row === null) return null
    const receipt = z
      .object({ fingerprint: z.string(), organization_revision: z.number().int().positive() })
      .parse(row)
    if (
      receipt.fingerprint !== fingerprint ||
      receipt.organization_revision !== command.props.expectedRevision + 1
    )
      return this.conflict()
    return {
      employeeIds: command.props.employees.map((employee) => employee.employeeId),
      organizationRevision: receipt.organization_revision,
      replayed: true,
    }
  }

  private conflict(): CompanyConflictError {
    return new CompanyConflictError(
      "接続対象または依頼が変更されています。再確認してください",
      "employee_resource_adoption_conflict",
    )
  }
  private tooLarge(): CompanyValidationError {
    return new CompanyValidationError(
      "一括接続の確認履歴が大きすぎます",
      "employee_resource_adoption_batch_too_large",
    )
  }
  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "一括接続を保存できませんでした",
      "employee_resource_adoption_batch_unavailable",
      { cause },
    )
  }
}
