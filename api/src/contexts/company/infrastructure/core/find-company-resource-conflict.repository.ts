import type { CompanyResourceWriteResult } from "@/contexts/company/infrastructure/core/company-resource-port.repository"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"

export async function findCompanyResourceConflict(
  database: D1Database,
  change: CompanyResourceChange,
): Promise<Extract<CompanyResourceWriteResult, { kind: "resource_conflict" }> | null> {
  for (const resource of change.resources) {
    const actualRevision =
      (
        await database
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
