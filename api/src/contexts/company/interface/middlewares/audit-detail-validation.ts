import { parseAuditEventId } from "@/contexts/company/interface/utils/parse-audit-event-id"
import { throwAuditRouteError } from "@/contexts/company/interface/utils/throw-audit-route-error"
import { factory } from "@/contexts/company/interface/utils/factory"

type AuditDetailValidationInput = {
  in: { param: { eventId: string } }
  out: { param: { eventId: string } }
}

/** Canonical detail-path validator placed after authentication and the permission gate. */
export const auditDetailValidation = factory.createMiddleware<AuditDetailValidationInput>(
  async (c, next) => {
    try {
      c.req.addValidatedData("param", { eventId: parseAuditEventId(c.req.param("eventId")) })
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
