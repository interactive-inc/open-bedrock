import { DecideExpense } from "@/contexts/expense/application/decide-expense"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpenseDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** POST /expenses/:id/approve — 経費を承認する（承認権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().max(3_000).nullable(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const expenseId = validateIntParam(c.req.param("id"), "expense")

    if (session.hasPermission("expense:approve") === false) {
      throw new ForbiddenError()
    }

    const body = c.req.valid("json")

    const updated = await new DecideExpense(c).run({
      session: session,
      expenseId,
      approverId: session.employeeId,
      action: "approve",
      comment: body.comment,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppExpenseDecision.parse({ status: updated.status })

    return c.json(responseBody, 200)
  },
)
