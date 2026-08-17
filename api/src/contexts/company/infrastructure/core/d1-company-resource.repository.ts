import type {
  CompanyResourceQuery,
  CompanyResourceReadResult,
  CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/application/core/company-resource.repository"
import {
  isCompanyResourceType,
  validateCompanyResource,
  type CompanyJsonObject,
  type CompanyResource,
  type CompanyResourceChange,
} from "@/contexts/company/domain/core/company-resource"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"

type ResourceRow = Readonly<{
  organization_id: string
  resource_type: string
  resource_id: string
  revision: number
  state: string
  effective_from: string
  effective_to: string | null
  attributes_json: string
}>

type ReceiptRow = Readonly<{ fingerprint: string; organization_revision: number }>

const textEncoder = new TextEncoder()

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function fingerprint(change: CompanyResourceChange): Promise<string | Error> {
  const canonical = toCanonicalSystemJson({
    expectedRevision: change.expectedRevision,
    actorAccountId: change.actorAccountId,
    reason: change.reason,
    resources: change.resources,
  })
  if (canonical instanceof Error) return canonical
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(canonical))
  return bytesToHex(new Uint8Array(digest))
}

function toResource(row: ResourceRow): CompanyResource | Error {
  if (!isCompanyResourceType(row.resource_type)) return new Error("Unknown Company resource type")
  if (row.state !== "active" && row.state !== "void") return new Error("Invalid Company state")

  let attributes: unknown
  try {
    attributes = JSON.parse(row.attributes_json)
  } catch (cause) {
    return new Error("Invalid Company attributes", { cause })
  }
  if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) {
    return new Error("Invalid Company attributes")
  }

  const resource = {
    organizationId: row.organization_id,
    type: row.resource_type,
    id: row.resource_id,
    revision: row.revision,
    state: row.state,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    attributes: attributes as CompanyJsonObject,
  } as CompanyResource
  const error = validateCompanyResource(resource)
  return error ?? resource
}

function placeholders(values: ReadonlyArray<unknown>): string {
  return values.map(() => "?").join(", ")
}

/** D1 transaction batch上でCompanyのappend-only履歴と現在projectionを同時更新する。 */
export class D1CompanyResourceRepository implements CompanyResourceRepository {
  constructor(private readonly database: D1Database) {
    Object.freeze(this)
  }

  async read(query: CompanyResourceQuery): Promise<CompanyResourceReadResult> {
    if (query.types.length < 1 || query.types.length > 100 || (query.ids?.length ?? 0) > 100) {
      return { ok: false, cause: new Error("Invalid Company resource query") }
    }

    try {
      const binds: unknown[] = []
      const conditions = [`resource_type IN (${placeholders(query.types)})`]
      binds.push(...query.types)
      if (query.ids !== undefined && query.ids.length > 0) {
        conditions.push(`resource_id IN (${placeholders(query.ids)})`)
        binds.push(...query.ids)
      }

      const resourceStatement =
        query.effectiveOn === undefined
          ? this.database
              .prepare(
                `SELECT organization_id, resource_type, resource_id, revision, state,
                        effective_from, effective_to, attributes_json
                   FROM company_resource_heads
                  WHERE organization_id = ?
                    AND state = 'active'
                    AND ${conditions.join(" AND ")}
                  ORDER BY resource_type, resource_id`,
              )
              .bind(query.organizationId, ...binds)
          : this.database
              .prepare(
                `WITH snapshot AS (
                   SELECT revision
                     FROM company_organizations
                    WHERE id = ?
                 ),
                 ranked_resources AS (
                   SELECT resource.organization_id,
                          resource.resource_type,
                          resource.resource_id,
                          resource.revision,
                          resource.state,
                          resource.effective_from,
                          resource.effective_to,
                          resource.attributes_json,
                          row_number() OVER (
                            PARTITION BY resource.resource_type, resource.resource_id
                            ORDER BY resource.effective_from DESC, resource.revision DESC
                          ) AS effective_rank
                     FROM company_resource_revisions AS resource
                     CROSS JOIN snapshot
                    WHERE resource.organization_id = ?
                      AND resource.organization_revision <= snapshot.revision
                      AND resource.effective_from <= ?
                      AND ${conditions.map((condition) => `resource.${condition}`).join(" AND ")}
                 )
                 SELECT organization_id, resource_type, resource_id, revision, state,
                        effective_from, effective_to, attributes_json
                   FROM ranked_resources
                  WHERE effective_rank = 1
                    AND state = 'active'
                    AND (effective_to IS NULL OR effective_to > ?)
                  ORDER BY resource_type, resource_id`,
              )
              .bind(
                query.organizationId,
                query.organizationId,
                query.effectiveOn,
                ...binds,
                query.effectiveOn,
              )

      const [revisionResult, resourceResult] = await this.database.batch([
        this.database
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(query.organizationId),
        resourceStatement,
      ])
      const revision = (revisionResult?.results[0] as { revision?: unknown } | undefined)?.revision
      if (
        revision !== undefined &&
        (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      ) {
        return { ok: false, cause: new Error("Invalid Company organization revision") }
      }
      const rows = (resourceResult?.results ?? []) as unknown as ResourceRow[]
      const resources: CompanyResource[] = []
      for (const row of rows) {
        const resource = toResource(row)
        if (resource instanceof Error) return { ok: false, cause: resource }
        resources.push(resource)
      }
      return {
        ok: true,
        organizationRevision: revision === undefined ? 0 : Number(revision),
        resources,
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async write(change: CompanyResourceChange): Promise<CompanyResourceWriteResult> {
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined)
      return { kind: "unavailable", cause: new Error("Empty change") }
    const commandFingerprint = await fingerprint(change)
    if (commandFingerprint instanceof Error) {
      return { kind: "unavailable", cause: commandFingerprint }
    }

    const replay = await this.readReceipt(organizationId, change.commandId)
    if (replay !== null) {
      return replay.fingerprint === commandFingerprint
        ? { kind: "applied", organizationRevision: replay.organization_revision, replayed: true }
        : { kind: "command_conflict" }
    }

    const actualRevision = await this.readOrganizationRevision(organizationId)
    if (actualRevision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision }
    }
    const resourceConflict = await this.findResourceConflict(change)
    if (resourceConflict !== null) return resourceConflict

    const organizationRevision = change.expectedRevision + 1
    const statements: D1PreparedStatement[] = []
    if (change.expectedRevision === 0) {
      statements.push(
        this.database
          .prepare(
            "INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)",
          )
          .bind(organizationId, change.recordedAt, change.recordedAt),
      )
    }
    statements.push(
      this.database
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
        this.database
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
        this.database
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
      this.database
        .prepare(
          "UPDATE company_organizations SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?",
        )
        .bind(organizationRevision, change.recordedAt, organizationId, change.expectedRevision),
    )

    try {
      await this.database.batch(statements)
      return { kind: "applied", organizationRevision, replayed: false }
    } catch (cause) {
      const concurrentReplay = await this.readReceipt(organizationId, change.commandId)
      if (concurrentReplay !== null) {
        return concurrentReplay.fingerprint === commandFingerprint
          ? {
              kind: "applied",
              organizationRevision: concurrentReplay.organization_revision,
              replayed: true,
            }
          : { kind: "command_conflict" }
      }
      const concurrentRevision = await this.readOrganizationRevision(organizationId)
      if (concurrentRevision !== change.expectedRevision) {
        return { kind: "conflict", actualRevision: concurrentRevision }
      }
      const concurrentResourceConflict = await this.findResourceConflict(change)
      return concurrentResourceConflict ?? { kind: "unavailable", cause }
    }
  }

  private async readReceipt(organizationId: string, commandId: string): Promise<ReceiptRow | null> {
    return this.database
      .prepare(
        "SELECT fingerprint, organization_revision FROM company_command_receipts WHERE organization_id = ? AND command_id = ?",
      )
      .bind(organizationId, commandId)
      .first<ReceiptRow>()
  }

  private async readOrganizationRevision(organizationId: string): Promise<number> {
    return (
      (
        await this.database
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(organizationId)
          .first<{ revision: number }>()
      )?.revision ?? 0
    )
  }

  private async findResourceConflict(
    change: CompanyResourceChange,
  ): Promise<Extract<CompanyResourceWriteResult, { kind: "resource_conflict" }> | null> {
    for (const resource of change.resources) {
      const actualRevision =
        (
          await this.database
            .prepare(
              `SELECT revision FROM company_resource_heads
              WHERE organization_id = ? AND resource_type = ? AND resource_id = ?`,
            )
            .bind(resource.organizationId, resource.type, resource.id)
            .first<{ revision: number }>()
        )?.revision ?? 0
      if (resource.revision !== actualRevision + 1) {
        return { kind: "resource_conflict", type: resource.type, id: resource.id, actualRevision }
      }
    }
    return null
  }
}
