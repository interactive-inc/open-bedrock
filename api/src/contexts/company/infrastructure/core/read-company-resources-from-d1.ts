import type {
  CompanyResourceQuery,
  CompanyResourceReadResult,
} from "@/contexts/company/application/core/company-resource-persistence"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { companyResourcePlaceholders } from "@/contexts/company/infrastructure/core/company-resource-placeholders"
import type { CompanyResourceRow } from "@/contexts/company/infrastructure/core/company-resource-row"
import { toCompanyResource } from "@/contexts/company/infrastructure/core/to-company-resource"

export async function readCompanyResourcesFromD1(
  database: D1Database,
  query: CompanyResourceQuery,
): Promise<CompanyResourceReadResult> {
  if (query.types.length < 1 || query.types.length > 100 || (query.ids?.length ?? 0) > 100) {
    return { ok: false, cause: new Error("Invalid Company resource query") }
  }

  try {
    const binds: unknown[] = []
    const conditions = [`resource_type IN (${companyResourcePlaceholders(query.types)})`]
    binds.push(...query.types)
    if (query.ids !== undefined && query.ids.length > 0) {
      conditions.push(`resource_id IN (${companyResourcePlaceholders(query.ids)})`)
      binds.push(...query.ids)
    }

    const resourceStatement =
      query.effectiveOn === undefined
        ? database
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
        : database
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

    const [revisionResult, resourceResult] = await database.batch([
      database
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

    const resources: CompanyResource[] = []
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
