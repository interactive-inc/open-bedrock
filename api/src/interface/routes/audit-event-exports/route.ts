import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { AuditTrail } from "@/interface/utils/audit-trail"
import { throwAuditRouteError } from "@/interface/utils/throw-audit-route-error"
import { auditExportPermission } from "@/interface/middlewares/audit-export-permission"
import { auditExportValidation } from "@/interface/middlewares/audit-export-validation"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { toAuditCsv } from "@/lib/audit/to-audit-csv"
import { PayloadTooLargeError } from "@/lib/errors"
import { factory } from "@/interface/utils/factory"

// @authorization permission - 権限キーで判定する
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
          await new AuditTrail(c).appendExportTooLarge(range.filters)
        } catch (auditError) {
          throwAuditRouteError(auditError)
        }
      }
      throwAuditRouteError(error)
    }

    try {
      await new AuditTrail(c).appendExportSucceeded(range.filters, rows.length)
    } catch (error) {
      throwAuditRouteError(error)
    }

    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-events.csv"',
    })
  },
)
