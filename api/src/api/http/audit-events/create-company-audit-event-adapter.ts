import { AuditEventAdapter } from "@/api/http/audit/audit-event.adapter"
import type { Context } from "@/env"

export type CompanyAuditExportRows = Awaited<ReturnType<AuditEventAdapter["export"]>>

/** Companyの公開監査projectionを製品audit compositionへ接続する。 */
export function createCompanyAuditEventAdapter(context: Context): AuditEventAdapter {
  return new AuditEventAdapter(context)
}
