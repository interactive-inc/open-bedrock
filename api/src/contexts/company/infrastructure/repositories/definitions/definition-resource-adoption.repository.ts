import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import type { DefinitionResourceAdoptionEntity } from "@/contexts/company/domain/entities/definition-resource-adoption.entity"
import {
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyUnavailableError,
} from "@/contexts/company/domain/errors"
import { DefinitionResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/definition-resource-adoption-snapshot.value"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { DefinitionResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/definition-resource-adoption-snapshot.adapter"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
const receiptSchema = z.object({
  fingerprint: z.string(),
  resource_id: z.string(),
  resource_type: z.enum(["grade", "position"]),
  definition_id: z.number().int().positive(),
  organization_revision: z.number().int().positive(),
})

/** 元の定義の証跡と公開履歴を一緒に保存し、接続済みの旧台帳を再更新させない。 */
export class DefinitionResourceAdoptionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async adopt(command: DefinitionResourceAdoptionEntity) {
    const canonical = CanonicalSystemJsonValue.create({ ...command.props, recordedAt: null })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    try {
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      const applied = await this.apply(command, fingerprint).catch((cause: unknown) =>
        this.unavailable(cause),
      )
      if (!(applied instanceof Error)) return applied
      const raced = await this.replay(command.props.commandId, fingerprint)
      if (raced !== null) return raced
      const current = await new DefinitionResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
        command.props.type,
        command.props.definitionId,
      )
      if (
        current === null ||
        (!(current instanceof Error) &&
          (current.props.digest !== command.props.snapshotDigest ||
            (await this.hasConflict(command, current.props.value.definition.code))))
      )
        return this.conflict()
      return applied
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private async apply(command: DefinitionResourceAdoptionEntity, fingerprint: string) {
    const today = resolveCompanyBusinessDate({
      now: new Date(command.props.recordedAt).toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (today instanceof Error) return this.unavailable(today)
    if (today !== command.props.observedOn) return this.conflict()
    const snapshots = new DefinitionResourceAdoptionSnapshotAdapter(this.c.env.DB)
    const snapshot = await snapshots.find(command.props.type, command.props.definitionId)
    if (snapshot instanceof Error) return this.unavailable(snapshot)
    if (snapshot === null)
      return new CompanyNotFoundError("定義が見つかりません", "definition_not_found")
    const change = command.toChange(snapshot)
    if (change instanceof Error) return change
    const code = snapshot.props.value.definition.code
    if (await this.hasConflict(command, code)) return this.conflict()
    const journal = await new CompanyResourceJournalAdapter({
      database: drizzle(this.c.env.DB),
      d1: this.c.env.DB,
    }).prepare(change)
    if (journal instanceof Error) return this.unavailable(journal)
    const organizationRevision = command.props.expectedRevision + 1
    await this.c.env.DB.batch([
      snapshots.prepareGuard(snapshot),
      this.c.env.DB.prepare(
        `SELECT CASE WHEN NOT EXISTS (${this.conflictQuery()}) THEN 1 ELSE json_extract('', '$') END`,
      ).bind(command.props.type, command.props.definitionId, command.props.resourceId, code),
      ...journal.statements,
      journal.commit,
      this.c.env.DB.prepare(`INSERT INTO company_definition_resource_adoptions
        (organization_id, command_id, resource_type, definition_id, resource_id, fingerprint,
         actor_account_id, reason, expected_revision, organization_revision, observed_on,
         snapshot_digest, source_json, recorded_at)
        VALUES ('organization:default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`).bind(
        command.props.commandId,
        command.props.type,
        command.props.definitionId,
        command.props.resourceId,
        fingerprint,
        command.props.actorAccountId,
        command.props.reason,
        command.props.expectedRevision,
        organizationRevision,
        command.props.observedOn,
        snapshot.props.digest,
        snapshot.props.sourceJson,
        command.props.recordedAt,
      ),
    ])
    return {
      type: command.props.type,
      definitionId: command.props.definitionId,
      resourceId: command.props.resourceId,
      organizationRevision,
      replayed: false,
    }
  }

  async find(commandId: string) {
    try {
      const row = await this.c.env.DB.prepare(`SELECT command_id, resource_type, resource_id,
        definition_id, actor_account_id, reason, organization_revision, observed_on,
        snapshot_digest, source_json, recorded_at FROM company_definition_resource_adoptions
        WHERE organization_id = 'organization:default' AND command_id = ?1`)
        .bind(commandId)
        .first()
      if (row === null) return null
      const record = z
        .object({
          command_id: z.string(),
          resource_type: z.enum(["grade", "position"]),
          resource_id: z.string(),
          definition_id: z.number().int().positive(),
          actor_account_id: z.string(),
          reason: z.string(),
          organization_revision: z.number().int().positive(),
          observed_on: z.string().date(),
          snapshot_digest: z.string(),
          source_json: z.string(),
          recorded_at: z.number().int().nonnegative(),
        })
        .parse(row)
      const source = await DefinitionResourceAdoptionSnapshotValue.create(record.source_json)
      if (source instanceof Error) return this.unavailable(source)
      if (source.props.digest !== record.snapshot_digest)
        return this.unavailable(new Error("definition adoption evidence digest mismatch"))
      return {
        commandId: record.command_id,
        type: record.resource_type,
        resourceId: record.resource_id,
        definitionId: record.definition_id,
        actorAccountId: record.actor_account_id,
        reason: record.reason,
        organizationRevision: record.organization_revision,
        observedOn: record.observed_on,
        recordedAt: record.recorded_at,
        snapshotDigest: record.snapshot_digest,
        source: source.props.value,
      }
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private async replay(commandId: string, fingerprint: string) {
    const row =
      await this.c.env.DB.prepare(`SELECT fingerprint, resource_type, resource_id, definition_id, organization_revision
      FROM company_definition_resource_adoptions WHERE organization_id = 'organization:default' AND command_id = ?1`)
        .bind(commandId)
        .first()
    if (row === null) return null
    const receipt = receiptSchema.parse(row)
    if (receipt.fingerprint !== fingerprint) return this.conflict()
    return {
      type: receipt.resource_type,
      definitionId: receipt.definition_id,
      resourceId: receipt.resource_id,
      organizationRevision: receipt.organization_revision,
      replayed: true,
    }
  }

  private async hasConflict(
    command: DefinitionResourceAdoptionEntity,
    code: string,
  ): Promise<boolean> {
    return (
      (await this.c.env.DB.prepare(this.conflictQuery())
        .bind(command.props.type, command.props.definitionId, command.props.resourceId, code)
        .first()) !== null
    )
  }

  private conflictQuery(): string {
    return `SELECT 1 FROM company_definition_resource_adoptions WHERE resource_type = ?1 AND definition_id = ?2
      UNION ALL SELECT 1 FROM company_resource_heads WHERE organization_id = 'organization:default'
      AND resource_type = ?1 AND (resource_id = ?3 OR json_extract(attributes_json, '$.code') = ?4)`
  }

  private conflict(): CompanyConflictError {
    return new CompanyConflictError(
      "移行対象または依頼が変更されています。再確認してください",
      "definition_resource_adoption_conflict",
    )
  }

  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "定義を接続できませんでした",
      "definition_resource_adoption_unavailable",
      { cause },
    )
  }
}
