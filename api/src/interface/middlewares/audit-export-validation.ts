import type { ParsedAuditExportRange } from "@/interface/utils/audit-route-contract"
import {
  parseAuditExportRange,
  readBoundedAuditExportJson,
  throwAuditRouteError,
} from "@/interface/utils/audit-route-contract"
import { factory } from "@/interface/utils/factory"

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
  out: { json: ParsedAuditExportRange }
}

/** Bounded stream reader and strict JSON validator placed after the export permission gate. */
export const auditExportValidation = factory.createMiddleware<AuditExportValidationInput>(
  async (c, next) => {
    try {
      const body = await readBoundedAuditExportJson(c.req.raw)
      c.req.addValidatedData("json", parseAuditExportRange(body))
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
