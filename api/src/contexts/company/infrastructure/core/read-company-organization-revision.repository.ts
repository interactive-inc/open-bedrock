export async function readCompanyOrganizationRevision(
  database: D1Database,
  organizationId: string,
): Promise<number> {
  return (
    (
      await database
        .prepare("SELECT revision FROM company_organizations WHERE id = ?")
        .bind(organizationId)
        .first<{ revision: number }>()
    )?.revision ?? 0
  )
}
