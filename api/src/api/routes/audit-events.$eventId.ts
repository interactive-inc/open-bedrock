import { createCompanyAuditEventRepository } from "@/api/http/audit-events/create-company-audit-event-repository"
import { AuditTrail } from "@/api/http/utils/audit-trail"
import { auditEventNotFound } from "@/api/http/utils/audit-event-not-found"
import { throwAuditRouteError } from "@/api/http/utils/throw-audit-route-error"
import { toPublicAuditDetail } from "@/api/http/utils/to-public-audit-detail"
import { auditDetailPermission } from "@/api/http/middlewares/audit-detail-permission"
import { auditDetailValidation } from "@/api/http/middlewares/audit-detail-validation"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  auditDetailPermission,
  auditDetailValidation,
  async (c) => {
    const { eventId } = c.req.valid("param")
    try {
      const detail = await createCompanyAuditEventRepository(c).findByEventId(eventId)
      if (detail === null) {
        await new AuditTrail(c).appendReadSucceeded(eventId, 0)
        throw auditEventNotFound()
      }

      const response = toPublicAuditDetail(detail)
      await new AuditTrail(c).appendReadSucceeded(eventId, 1)
      return c.json(response, 200)
    } catch (error) {
      throwAuditRouteError(error)
    }
  },
)
