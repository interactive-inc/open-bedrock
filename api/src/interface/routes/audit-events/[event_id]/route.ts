import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { AuditTrail } from "@/interface/utils/audit-trail"
import {
  auditEventNotFound,
  throwAuditRouteError,
  toPublicAuditDetail,
} from "@/interface/utils/audit-route-contract"
import { auditDetailPermission } from "@/interface/middlewares/audit-detail-permission"
import { auditDetailValidation } from "@/interface/middlewares/audit-detail-validation"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

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
