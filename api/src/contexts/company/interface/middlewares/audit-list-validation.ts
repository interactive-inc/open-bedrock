import { AuditListQuery } from "@/contexts/company/interface/utils/audit-list-query"
import { throwAuditRouteError } from "@/contexts/company/interface/utils/throw-audit-route-error"
import { factory } from "@/contexts/company/interface/utils/factory"

type AuditListValidationInput = {
  in: {
    query?: {
      actor_account_id?: string
      action?: string
      target_type?: string
      target_id?: string
      outcome?: "succeeded" | "denied" | "failed"
      from?: string
      to?: string
      limit?: string
      cursor?: string
    }
  }
  out: { query: AuditListQuery }
}

/** Strict list validator placed after authentication and the permission gate. */
export const auditListValidation = factory.createMiddleware<AuditListValidationInput>(
  async (c, next) => {
    try {
      c.req.addValidatedData("query", AuditListQuery.parse(c.req.url))
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
