import { AuditExportRange } from "@/contexts/company/interface/utils/audit-export-range"
import { throwAuditRouteError } from "@/contexts/company/interface/utils/throw-audit-route-error"
import { factory } from "@/contexts/company/interface/utils/factory"

type AuditExportValidationInput = {
  in: {
    json: {
      actor_account_id?: number
      action?: string
      target_type?: string
      target_id?: string
      outcome?: "succeeded" | "denied" | "failed"
      from: string
      to: string
    }
  }
  out: { json: AuditExportRange }
}

/** Bounded stream reader and strict JSON validator placed after the export permission gate. */
export const auditExportValidation = factory.createMiddleware<AuditExportValidationInput>(
  async (c, next) => {
    try {
      c.req.addValidatedData("json", await AuditExportRange.fromRequest(c.req.raw))
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
