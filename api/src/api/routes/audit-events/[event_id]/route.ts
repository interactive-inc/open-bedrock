import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { AuditTrail } from "@/contexts/company/interface/utils/audit-trail"
import { auditEventNotFound } from "@/contexts/company/interface/utils/audit-event-not-found"
import { throwAuditRouteError } from "@/contexts/company/interface/utils/throw-audit-route-error"
import { toPublicAuditDetail } from "@/contexts/company/interface/utils/to-public-audit-detail"
import { auditDetailPermission } from "@/contexts/company/interface/middlewares/audit-detail-permission"
import { auditDetailValidation } from "@/contexts/company/interface/middlewares/audit-detail-validation"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  auditDetailPermission,
  auditDetailValidation,
  async (c) => {
    const { event_id: eventId } = c.req.valid("param")
    try {
      const detail = await new AuditEventRepository(c).findByEventId(eventId)
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
