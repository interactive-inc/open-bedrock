import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import {
  appendAuditReadSucceeded,
  auditDetailPermission,
  auditDetailValidation,
  auditEventNotFound,
  throwAuditRouteError,
  toPublicAuditDetail,
} from "@/interface/audit/audit-route-contract"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

export const GET = factory.createHandlers(
  verifyBearer,
  auditDetailPermission,
  auditDetailValidation,
  async (c) => {
    const { event_id: eventId } = c.req.valid("param")
    try {
      const detail = await new AuditEventRepository(c).findByEventId(eventId)
      if (detail === null) {
        await appendAuditReadSucceeded(c, eventId, 0)
        throw auditEventNotFound()
      }

      const response = toPublicAuditDetail(detail)
      await appendAuditReadSucceeded(c, eventId, 1)
      return c.json(response, 200)
    } catch (error) {
      throwAuditRouteError(error)
    }
  },
)
