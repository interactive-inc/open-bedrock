import type { ParsedAuditListQuery } from "@/interface/utils/audit-route-contract"
import { parseAuditListQuery, throwAuditRouteError } from "@/interface/utils/audit-route-contract"
import { factory } from "@/interface/utils/factory"

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
  out: { query: ParsedAuditListQuery }
}

/** Strict list validator placed after authentication and the permission gate. */
export const auditListValidation = factory.createMiddleware<AuditListValidationInput>(
  async (c, next) => {
    try {
      c.req.addValidatedData("query", parseAuditListQuery(c.req.url))
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
