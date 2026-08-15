import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { approvalDelegations } from "@/contexts/request/infrastructure/schema/request"
import { and, eq, isNull } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const id = validateIntParam(c.req.param("id"), "delegation")

  const existing = await c.var.database
    .select({ delegatorEmployeeId: approvalDelegations.delegatorEmployeeId })
    .from(approvalDelegations)
    .where(eq(approvalDelegations.id, id))
    .limit(1)
    .then((rows) => rows.at(0))
  if (existing === undefined) throw new NotFoundError("delegation not found")
  if (existing.delegatorEmployeeId !== session.employeeId) throw new ForbiddenError()

  await c.var.database
    .update(approvalDelegations)
    .set({ cancelledAt: c.env.NOW ?? new Date().toISOString() })
    .where(
      and(
        eq(approvalDelegations.id, id),
        eq(approvalDelegations.delegatorEmployeeId, session.employeeId),
        isNull(approvalDelegations.cancelledAt),
      ),
    )

  return c.body(null, 204)
})
