import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import {
  appendAuditSearchSucceeded,
  auditListPermission,
  auditListValidation,
  throwAuditRouteError,
  toPublicAuditPage,
} from "@/interface/audit/audit-route-contract"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

export const GET = factory.createHandlers(
  verifyBearer,
  auditListPermission,
  auditListValidation,
  async (c) => {
    const query = c.req.valid("query")
    try {
      const page = await new AuditEventRepository(c).search(query)
      const response = toPublicAuditPage(page)
      await appendAuditSearchSucceeded(c, query.filters, query.limit, response.data.length)
      return c.json(response, 200)
    } catch (error) {
      throwAuditRouteError(error)
    }
  },
)
