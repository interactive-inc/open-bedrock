import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import {
  appendAuditExportSucceeded,
  appendAuditExportTooLarge,
  auditExportPermission,
  auditExportValidation,
  throwAuditRouteError,
} from "@/interface/audit/audit-route-contract"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { toAuditCsv } from "@/lib/audit/audit-csv"
import { PayloadTooLargeError } from "@/lib/errors"
import { factory } from "@/lib/factory"

export const POST = factory.createHandlers(
  verifyBearer,
  auditExportPermission,
  auditExportValidation,
  async (c) => {
    const range = c.req.valid("json")
    let rows: Awaited<ReturnType<AuditEventRepository["export"]>>
    let csv: string
    try {
      rows = await new AuditEventRepository(c).export({ filters: range.filters })
      csv = toAuditCsv(rows)
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        try {
          await appendAuditExportTooLarge(c, range.filters)
        } catch (auditError) {
          throwAuditRouteError(auditError)
        }
      }
      throwAuditRouteError(error)
    }

    try {
      await appendAuditExportSucceeded(c, range.filters, rows.length)
    } catch (error) {
      throwAuditRouteError(error)
    }

    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-events.csv"',
    })
  },
)
