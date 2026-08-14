import { AuditTrail } from "@/contexts/company/interface/utils/audit-trail"
import { factory } from "@/contexts/company/interface/utils/factory"

/** 監査ログエクスポートの権限ゲート。audit:export が無ければ denied を記録して 403。 */
export const auditExportPermission = factory.createMiddleware((c, next) =>
  new AuditTrail(c).requireExportPermission(next),
)
