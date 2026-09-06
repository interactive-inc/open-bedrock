import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { compareCompanyResourcePersistence } from "@/contexts/company/domain/definitions/compare-company-resource-persistence.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = D1Database
export type PreparedCompanyResourceJournal = Readonly<{
  fingerprint: string
  statements: ReadonlyArray<D1PreparedStatement>
  commit: D1PreparedStatement
}>

/** 公開writeと人事発令で共有する、版・履歴・再送記録のtransaction部品。 */
export class CompanyResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    change: CompanyResourceChangeEntity,
  ): Promise<PreparedCompanyResourceJournal | Error> {
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined) return new Error("empty Company command")
    const canonical = CanonicalSystemJsonValue.create({
      expectedRevision: change.expectedRevision,
      actorAccountId: change.actorAccountId,
      reason: change.reason,
      resources: change.resources.map((resource) => ({
        organizationId: resource.organizationId,
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        state: resource.state,
        effectiveFrom: resource.effectiveFrom,
        effectiveTo: resource.effectiveTo,
        attributes: resource.attributes,
      })),
    })
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    const commandFingerprint = digest.toString()
    const organizationRevision = change.expectedRevision + 1
    const statements: D1PreparedStatement[] = []
    if (change.expectedRevision === 0) {
      statements.push(
        this.c
          .prepare(
            "INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)",
          )
          .bind(organizationId, change.recordedAt, change.recordedAt),
      )
    }
    statements.push(
      this.c
        .prepare(
          `INSERT INTO company_command_receipts
             (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          organizationId,
          change.commandId,
          commandFingerprint,
          change.expectedRevision,
          organizationRevision,
          change.recordedAt,
        ),
    )

    for (const resource of change.resources.toSorted(compareCompanyResourcePersistence)) {
      const attributesJson = CanonicalSystemJsonValue.create(resource.attributes)
      if (attributesJson instanceof Error) return attributesJson
      const values: ReadonlyArray<string | number | null> = [
        resource.organizationId,
        resource.type,
        resource.id,
        resource.revision,
        organizationRevision,
        resource.state,
        resource.effectiveFrom,
        resource.effectiveTo,
        attributesJson.toString(),
      ]
      statements.push(
        this.c
          .prepare(
            `INSERT INTO company_resource_revisions
               (organization_id, resource_type, resource_id, revision, organization_revision,
                state, effective_from, effective_to, attributes_json, command_id,
                actor_account_id, reason, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            ...values,
            change.commandId,
            change.actorAccountId,
            change.reason,
            change.recordedAt,
          ),
      )
      statements.push(
        this.c
          .prepare(
            `INSERT INTO company_resource_heads
               (organization_id, resource_type, resource_id, revision, organization_revision,
                state, effective_from, effective_to, attributes_json, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (organization_id, resource_type, resource_id) DO UPDATE SET
               revision = excluded.revision,
               organization_revision = excluded.organization_revision,
               state = excluded.state,
               effective_from = excluded.effective_from,
               effective_to = excluded.effective_to,
               attributes_json = excluded.attributes_json,
               updated_at = excluded.updated_at`,
          )
          .bind(...values, change.recordedAt),
      )
    }

    return {
      fingerprint: commandFingerprint,
      statements,
      commit: this.c
        .prepare(
          "UPDATE company_organizations SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?",
        )
        .bind(organizationRevision, change.recordedAt, organizationId, change.expectedRevision),
    }
  }
}
