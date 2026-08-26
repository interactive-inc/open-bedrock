import type { CompanyJsonObject } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"

export type CompanyResourceQuery = Readonly<{
  organizationId: string
  types: ReadonlyArray<CompanyResourceType>
  ids?: ReadonlyArray<string>
  effectiveOn?: CalendarDate
}>

export type CompanyResourceReadResult =
  | Readonly<{
      ok: true
      organizationRevision: number
      resources: ReadonlyArray<CompanyResourceEntity>
    }>
  | Readonly<{ ok: false; cause: unknown }>

export type CompanyResourceWriteResult =
  | Readonly<{ kind: "applied"; organizationRevision: number; replayed: boolean }>
  | Readonly<{ kind: "conflict"; actualRevision: number }>
  | Readonly<{ kind: "command_conflict" }>
  | Readonly<{
      kind: "resource_conflict"
      type: CompanyResourceType
      id: string
      actualRevision: number
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export type CompanyResourceRepository = Readonly<{
  read: (query: CompanyResourceQuery) => Promise<CompanyResourceReadResult>
  write: (change: CompanyResourceChangeEntity) => Promise<CompanyResourceWriteResult>
}>

type CompanyResourceRow = Readonly<{
  organization_id: string
  resource_type: string
  resource_id: string
  revision: number
  state: string
  effective_from: string
  effective_to: string | null
  attributes_json: string
}>

type CompanyCommandReceiptRow = Readonly<{
  fingerprint: string
  organization_revision: number
}>

const textEncoder = new TextEncoder()

function placeholders(values: ReadonlyArray<unknown>): string {
  return values.map(() => "?").join(", ")
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function toCompanyResource(row: CompanyResourceRow): CompanyResourceEntity | Error {
  if (!CompanyResourceEntity.isType(row.resource_type)) {
    return new Error("Unknown Company resource type")
  }
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

  return CompanyResourceEntity.create({
    organizationId: row.organization_id,
    type: row.resource_type,
    id: row.resource_id,
    revision: row.revision,
    state: row.state,
    effectiveFrom: row.effective_from as CalendarDate,
    effectiveTo: row.effective_to as CalendarDate | null,
    attributes: attributes as CompanyJsonObject,
  })
}
type D1CompanyResourceRepositoryContext = D1Database
type Context = D1CompanyResourceRepositoryContext

/** Company resource revisions の D1 永続化。 */
export class D1CompanyResourceRepository implements CompanyResourceRepository {
  constructor(private readonly c: Context) {}

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
          ? this.c
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
          : this.c
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

      const [revisionResult, resourceResult] = await this.c.batch([
        this.c
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(query.organizationId),
        resourceStatement,
      ])
      const revisionRow = revisionResult?.results[0]
      const revision =
        revisionRow !== undefined &&
        revisionRow !== null &&
        typeof revisionRow === "object" &&
        "revision" in revisionRow
          ? revisionRow.revision
          : undefined
      if (
        revision !== undefined &&
        (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      ) {
        return { ok: false, cause: new Error("Invalid Company organization revision") }
      }

      const resources: CompanyResourceEntity[] = []
      for (const row of resourceResult?.results ?? []) {
        const resource = toCompanyResource(row as CompanyResourceRow)
        if (resource instanceof Error) return { ok: false, cause: resource }
        resources.push(resource)
      }
      return {
        ok: true,
        organizationRevision: revision === undefined ? 0 : revision,
        resources,
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async write(change: CompanyResourceChangeEntity): Promise<CompanyResourceWriteResult> {
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined) {
      return { kind: "unavailable", cause: new Error("Empty change") }
    }
    const commandFingerprint = await this.fingerprint(change)
    if (commandFingerprint instanceof Error) {
      return { kind: "unavailable", cause: commandFingerprint }
    }

    const replay = await this.readCommandReceipt(organizationId, change.commandId)
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

    for (const resource of change.resources) {
      const attributesJson = CanonicalSystemJsonValue.create(resource.attributes)
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
        attributesJson.toString(),
      ] as const
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
    statements.push(
      this.c
        .prepare(
          "UPDATE company_organizations SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?",
        )
        .bind(organizationRevision, change.recordedAt, organizationId, change.expectedRevision),
    )

    try {
      await this.c.batch(statements)
      return { kind: "applied", organizationRevision, replayed: false }
    } catch (cause) {
      const concurrentReplay = await this.readCommandReceipt(organizationId, change.commandId)
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

  private async fingerprint(change: CompanyResourceChangeEntity): Promise<string | Error> {
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
    const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(canonical.toString()))
    return bytesToHex(new Uint8Array(digest))
  }

  private readCommandReceipt(
    organizationId: string,
    commandId: string,
  ): Promise<CompanyCommandReceiptRow | null> {
    return this.c
      .prepare(
        "SELECT fingerprint, organization_revision FROM company_command_receipts WHERE organization_id = ? AND command_id = ?",
      )
      .bind(organizationId, commandId)
      .first<CompanyCommandReceiptRow>()
  }

  private async readOrganizationRevision(organizationId: string): Promise<number> {
    return (
      (
        await this.c
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(organizationId)
          .first<{ revision: number }>()
      )?.revision ?? 0
    )
  }

  private async findResourceConflict(
    change: CompanyResourceChangeEntity,
  ): Promise<Extract<CompanyResourceWriteResult, { kind: "resource_conflict" }> | null> {
    for (const resource of change.resources) {
      const actualRevision =
        (
          await this.c
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
