import { z } from "zod"
import type { GradeAwardArchiveEntity } from "@/contexts/company/domain/entities/grade-award-archive.entity"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnavailableError,
} from "@/contexts/company/domain/errors"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { GradeAwardSourceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-source-snapshot.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
type AuditContext = Readonly<{ authorizationJson: string; metadataJson: string }>
const recordSchema = z.object({
  command_id: z.string(),
  employee_id: z.string(),
  fingerprint: z.string(),
  actor_account_id: z.string(),
  reason: z.string(),
  observed_on: z.string().date(),
  observed_company_revision: z.number().int().nonnegative(),
  snapshot_digest: z.string(),
  source_json: z.string(),
  recorded_at: z.number().int().nonnegative(),
})

/** 旧等級付与の原記録と保全操作の監査を同時に固定する。雇用期間の確定は行わない。 */
export class GradeAwardArchiveRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async archive(command: GradeAwardArchiveEntity, auditContext: AuditContext) {
    const canonical = CanonicalSystemJsonValue.create({ ...command.props, recordedAt: null })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    try {
      const replay = await this.replay(command.props.commandId, digest.toString())
      if (replay !== null) return replay
      const applied = await this.apply(command, digest.toString(), auditContext).catch(
        (cause: unknown) => this.unavailable(cause),
      )
      if (!(applied instanceof Error)) return applied
      const raced = await this.replay(command.props.commandId, digest.toString())
      if (raced !== null) return raced
      const existing = await this.c.env.DB.prepare(
        "SELECT 1 FROM company_grade_award_archives WHERE organization_id = 'organization:default' AND employee_id = ?1",
      )
        .bind(command.props.employeeId)
        .first()
      if (existing !== null) return this.conflict()
      const current = await new GradeAwardSourceSnapshotAdapter(this.c.env.DB).find(
        command.props.employeeId,
      )
      if (!(current instanceof Error) && command.validateSource(current) !== null)
        return this.conflict()
      return applied
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private async apply(
    command: GradeAwardArchiveEntity,
    fingerprint: string,
    auditContext: AuditContext,
  ) {
    const today = resolveCompanyBusinessDate({
      now: new Date(command.props.recordedAt).toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (today instanceof Error) return this.unavailable(today)
    if (today !== command.props.observedOn) return this.conflict()
    const sources = new GradeAwardSourceSnapshotAdapter(this.c.env.DB)
    const source = await sources.find(command.props.employeeId)
    if (source instanceof CompanyOperationError) return source
    if (source instanceof Error) return this.unavailable(source)
    const conflict = command.validateSource(source)
    if (conflict !== null) return conflict
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.props.actorAccountId,
      action: "company.grade-award.archive",
      targetType: "company-grade-award-archive",
      targetId: command.props.commandId,
      outcome: "succeeded",
      reasonCode: null,
      beforeJson: null,
      afterJson: JSON.stringify({ ...command.props, fingerprint }),
      authorizationJson: auditContext.authorizationJson,
      metadataJson: auditContext.metadataJson,
      occurredAt: new Date(command.props.recordedAt),
    })
    if (audit instanceof Error) return this.unavailable(audit)
    const statements = [
      sources.prepareGuard(source),
      ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      this.c.env.DB.prepare(`INSERT INTO company_grade_award_archives
        (organization_id, command_id, employee_id, fingerprint, actor_account_id, reason,
         observed_on, observed_company_revision, snapshot_digest, source_json, recorded_at)
        VALUES ('organization:default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`).bind(
        command.props.commandId,
        command.props.employeeId,
        fingerprint,
        command.props.actorAccountId,
        command.props.reason,
        command.props.observedOn,
        command.props.expectedRevision,
        source.props.digest,
        source.props.sourceJson,
        command.props.recordedAt,
      ),
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM company_grade_award_archives WHERE organization_id = 'organization:default'
        AND command_id = ?1 AND employee_id = ?2 AND fingerprint = ?3 AND actor_account_id = ?4
        AND reason = ?5 AND observed_on = ?6 AND observed_company_revision = ?7
        AND snapshot_digest = ?8 AND source_json = ?9 AND recorded_at = ?10
      ) THEN 1 ELSE json_extract('', '$') END`).bind(
        command.props.commandId,
        command.props.employeeId,
        fingerprint,
        command.props.actorAccountId,
        command.props.reason,
        command.props.observedOn,
        command.props.expectedRevision,
        source.props.digest,
        source.props.sourceJson,
        command.props.recordedAt,
      ),
    ]
    const results = await this.c.env.DB.batch(statements)
    if (results.length !== statements.length || results.some((result) => !result.success))
      return this.unavailable(new Error("archive batch incomplete"))
    return {
      commandId: command.props.commandId,
      employeeId: command.props.employeeId,
      observedCompanyRevision: command.props.expectedRevision,
      replayed: false,
    }
  }

  async find(commandId: string) {
    try {
      const row = await this.c.env.DB.prepare(
        "SELECT * FROM company_grade_award_archives WHERE organization_id = 'organization:default' AND command_id = ?1",
      )
        .bind(commandId)
        .first()
      if (row === null) return null
      const record = recordSchema.parse(row)
      const source = await GradeAwardSourceSnapshotValue.create(record.source_json)
      if (source instanceof Error) return this.unavailable(source)
      if (
        source.props.digest !== record.snapshot_digest ||
        source.props.value.employeeId !== record.employee_id ||
        source.props.value.organizationRevision !== record.observed_company_revision
      )
        return this.unavailable(new Error("archive evidence mismatch"))
      return {
        commandId: record.command_id,
        employeeId: record.employee_id,
        actorAccountId: record.actor_account_id,
        reason: record.reason,
        observedOn: record.observed_on,
        observedCompanyRevision: record.observed_company_revision,
        recordedAt: record.recorded_at,
        snapshotDigest: record.snapshot_digest,
        source: source.props.value,
      }
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private async replay(commandId: string, fingerprint: string) {
    const row = await this.c.env.DB.prepare(
      "SELECT * FROM company_grade_award_archives WHERE organization_id = 'organization:default' AND command_id = ?1",
    )
      .bind(commandId)
      .first()
    if (row === null) return null
    const record = recordSchema.parse(row)
    if (record.fingerprint !== fingerprint) return this.conflict()
    const evidence = await this.find(commandId)
    if (evidence instanceof Error) return evidence
    if (evidence === null) return this.unavailable(new Error("archive receipt unavailable"))
    return {
      commandId,
      employeeId: record.employee_id,
      observedCompanyRevision: record.observed_company_revision,
      replayed: true,
    }
  }

  private conflict() {
    return new CompanyConflictError(
      "確認した等級付与または保全依頼が変更されています",
      "grade_award_archive_conflict",
    )
  }
  private unavailable(cause: unknown) {
    return new CompanyUnavailableError(
      "等級付与の原記録を保全できませんでした",
      "grade_award_archive_unavailable",
      { cause },
    )
  }
}
