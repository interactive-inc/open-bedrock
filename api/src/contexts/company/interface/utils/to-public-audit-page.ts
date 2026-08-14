import type { AuditEventPage } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { auditUnavailable } from "@/contexts/company/interface/utils/audit-unavailable"
import { toPublicAuditSummary } from "@/contexts/company/interface/utils/to-public-audit-summary"
import { zAppAuditEventPage } from "@/lib/app-schemas"
import type { AppAuditEventPage } from "@/lib/app-schemas"

/** Projects a repository page into the public list contract, failing closed on any drift. */
export function toPublicAuditPage(page: AuditEventPage): AppAuditEventPage {
  try {
    return zAppAuditEventPage.parse({
      data: page.items.map(toPublicAuditSummary),
      next_cursor: page.nextCursor,
      previous_cursor: page.previousCursor,
    })
  } catch (error) {
    throw auditUnavailable(error)
  }
}
