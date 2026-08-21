import { AuditEventRepository } from "@/api/http/audit/audit-event.repository"
import type { Context } from "@/env"

export type CompanyAuditExportRows = Awaited<ReturnType<AuditEventRepository["export"]>>

/** Companyの公開監査projectionを製品audit compositionへ接続する。 */
export function createCompanyAuditEventRepository(context: Context): AuditEventRepository {
  return new AuditEventRepository(context)
}
