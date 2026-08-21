import {
  createCompanyAuditEventRepository,
  type CompanyAuditExportRows,
} from "@/api/http/audit-events/create-company-audit-event-repository"
import { AuditTrail } from "@/api/http/utils/audit-trail"
import { throwAuditRouteError } from "@/api/http/utils/throw-audit-route-error"
import { auditExportPermission } from "@/api/http/middlewares/audit-export-permission"
import { auditExportValidation } from "@/api/http/middlewares/audit-export-validation"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toAuditCsv } from "@/api/http/audit/to-audit-csv"
import { PayloadTooLargeError } from "@/lib/errors"
import { factory } from "@/api/http/factory"

// @authorization permission - 権限キーで判定する
export const POST = factory.createHandlers(
  verifyBearer,
  auditExportPermission,
  auditExportValidation,
  async (c) => {
    const range = c.req.valid("json")
    let rows: CompanyAuditExportRows
    let csv: string
    try {
      rows = await createCompanyAuditEventRepository(c).export({ filters: range.filters })
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
