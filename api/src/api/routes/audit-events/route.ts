import { AuditEventRepository } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { AuditTrail } from "@/contexts/company-compatibility/interface/utils/audit-trail"
import { throwAuditRouteError } from "@/contexts/company-compatibility/interface/utils/throw-audit-route-error"
import { toPublicAuditPage } from "@/contexts/company-compatibility/interface/utils/to-public-audit-page"
import { auditListPermission } from "@/contexts/company-compatibility/interface/middlewares/audit-list-permission"
import { auditListValidation } from "@/contexts/company-compatibility/interface/middlewares/audit-list-validation"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  auditListPermission,
  auditListValidation,
  async (c) => {
    const query = c.req.valid("query")
    try {
      const page = await new AuditEventRepository(c).search({
        limit: query.limit,
        cursor: query.cursor,
        filters: query.filters,
      })
      const response = toPublicAuditPage(page)
      await new AuditTrail(c).appendSearchSucceeded(
        query.filters,
        query.limit,
        response.data.length,
      )
      return c.json(response, 200)
    } catch (error) {
      throwAuditRouteError(error)
    }
  },
)
