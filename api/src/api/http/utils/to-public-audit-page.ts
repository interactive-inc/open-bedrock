import type { AuditEventPage } from "@/api/http/audit/audit-event.adapter"
import { auditUnavailable } from "@/api/http/utils/audit-unavailable"
import { toPublicAuditSummary } from "@/api/http/utils/to-public-audit-summary"
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
