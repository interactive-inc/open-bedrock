import { parseAuditEventId } from "@/api/http/utils/parse-audit-event-id"
import { throwAuditRouteError } from "@/api/http/utils/throw-audit-route-error"
import { factory } from "@/api/http/factory"

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
