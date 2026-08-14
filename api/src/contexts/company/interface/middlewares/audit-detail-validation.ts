import { parseAuditEventId } from "@/contexts/company/interface/utils/parse-audit-event-id"
import { throwAuditRouteError } from "@/contexts/company/interface/utils/throw-audit-route-error"
import { factory } from "@/contexts/company/interface/utils/factory"

type AuditDetailValidationInput = {
  in: { param: { event_id: string } }
  out: { param: { event_id: string } }
}

/** Canonical detail-path validator placed after authentication and the permission gate. */
export const auditDetailValidation = factory.createMiddleware<AuditDetailValidationInput>(
  async (c, next) => {
    try {
      c.req.addValidatedData("param", { event_id: parseAuditEventId(c.req.param("event_id")) })
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
