import type { AuditEventDetail } from "@/composition/audit/audit-event"
import { auditUnavailable } from "@/contexts/company/interface/utils/audit-unavailable"
import { toPublicAuditSummary } from "@/contexts/company/interface/utils/to-public-audit-summary"
import { zAppAuditEventDetail } from "@/lib/app-schemas"
import type { AppAuditEventDetail } from "@/lib/app-schemas"

/** Projects a repository detail into the public contract, failing closed on any drift. */
export function toPublicAuditDetail(item: AuditEventDetail): AppAuditEventDetail {
  try {
    return zAppAuditEventDetail.parse({
      ...toPublicAuditSummary(item),
      authorization_json: item.authorizationJson,
      before_json: item.beforeJson,
      after_json: item.afterJson,
      metadata_json: item.metadataJson,
      client_ip: item.clientIp,
    })
  } catch (error) {
    throw auditUnavailable(error)
  }
}
