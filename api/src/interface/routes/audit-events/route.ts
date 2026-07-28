import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { AuditTrail } from "@/interface/utils/audit-trail"
import { throwAuditRouteError } from "@/interface/utils/throw-audit-route-error"
import { toPublicAuditPage } from "@/interface/utils/to-public-audit-page"
import { auditListPermission } from "@/interface/middlewares/audit-list-permission"
import { auditListValidation } from "@/interface/middlewares/audit-list-validation"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

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
