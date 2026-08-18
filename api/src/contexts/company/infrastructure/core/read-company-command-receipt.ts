import type { CompanyCommandReceiptRow } from "@/contexts/company/infrastructure/core/company-resource-row"

export async function readCompanyCommandReceipt(
  database: D1Database,
  organizationId: string,
  commandId: string,
): Promise<CompanyCommandReceiptRow | null> {
  return database
    .prepare(
      "SELECT fingerprint, organization_revision FROM company_command_receipts WHERE organization_id = ? AND command_id = ?",
    )
    .bind(organizationId, commandId)
    .first<CompanyCommandReceiptRow>()
}
