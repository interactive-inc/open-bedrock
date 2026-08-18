import type { CompanyResourceWriteResult } from "@/contexts/company/application/core/company-resource-persistence"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"
import { findCompanyResourceConflict } from "@/contexts/company/infrastructure/core/find-company-resource-conflict"
import { fingerprintCompanyResourceChange } from "@/contexts/company/infrastructure/core/fingerprint-company-resource-change"
import { readCompanyCommandReceipt } from "@/contexts/company/infrastructure/core/read-company-command-receipt"
import { readCompanyOrganizationRevision } from "@/contexts/company/infrastructure/core/read-company-organization-revision"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"

export async function writeCompanyResourcesToD1(
  database: D1Database,
  change: CompanyResourceChange,
): Promise<CompanyResourceWriteResult> {
  const organizationId = change.resources[0]?.organizationId
  if (organizationId === undefined) {
    return { kind: "unavailable", cause: new Error("Empty change") }
  }
  const commandFingerprint = await fingerprintCompanyResourceChange(change)
  if (commandFingerprint instanceof Error) {
    return { kind: "unavailable", cause: commandFingerprint }
  }

  const replay = await readCompanyCommandReceipt(database, organizationId, change.commandId)
  if (replay !== null) {
    return replay.fingerprint === commandFingerprint
      ? { kind: "applied", organizationRevision: replay.organization_revision, replayed: true }
      : { kind: "command_conflict" }
  }

  const actualRevision = await readCompanyOrganizationRevision(database, organizationId)
  if (actualRevision !== change.expectedRevision) {
    return { kind: "conflict", actualRevision }
  }
  const resourceConflict = await findCompanyResourceConflict(database, change)
  if (resourceConflict !== null) return resourceConflict

  const organizationRevision = change.expectedRevision + 1
  const statements: D1PreparedStatement[] = []
  if (change.expectedRevision === 0) {
    statements.push(
      database
        .prepare(
          "INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)",
        )
        .bind(organizationId, change.recordedAt, change.recordedAt),
    )
  }
  statements.push(
    database
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

  for (const resource of change.resources) {
    const attributesJson = toCanonicalSystemJson(resource.attributes)
    if (attributesJson instanceof Error) return { kind: "unavailable", cause: attributesJson }
    const values = [
      resource.organizationId,
      resource.type,
      resource.id,
      resource.revision,
      organizationRevision,
      resource.state,
      resource.effectiveFrom,
      resource.effectiveTo,
      attributesJson,
    ] as const
    statements.push(
      database
        .prepare(
          `INSERT INTO company_resource_revisions
             (organization_id, resource_type, resource_id, revision, organization_revision,
              state, effective_from, effective_to, attributes_json, command_id,
              actor_account_id, reason, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(...values, change.commandId, change.actorAccountId, change.reason, change.recordedAt),
    )
    statements.push(
      database
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
  statements.push(
    database
      .prepare(
        "UPDATE company_organizations SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?",
      )
      .bind(organizationRevision, change.recordedAt, organizationId, change.expectedRevision),
  )

  try {
    await database.batch(statements)
    return { kind: "applied", organizationRevision, replayed: false }
  } catch (cause) {
    const concurrentReplay = await readCompanyCommandReceipt(
      database,
      organizationId,
      change.commandId,
    )
    if (concurrentReplay !== null) {
      return concurrentReplay.fingerprint === commandFingerprint
        ? {
            kind: "applied",
            organizationRevision: concurrentReplay.organization_revision,
            replayed: true,
          }
        : { kind: "command_conflict" }
    }
    const concurrentRevision = await readCompanyOrganizationRevision(database, organizationId)
    if (concurrentRevision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision: concurrentRevision }
    }
    const concurrentResourceConflict = await findCompanyResourceConflict(database, change)
    return concurrentResourceConflict ?? { kind: "unavailable", cause }
  }
}
