import { DecideExpense } from "@/application/expense/decide-expense"
import { canDecideExpense } from "@/lib/expense/can-decide-expense"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpenseDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// POST /expenses/:id/approve — 経費を承認する（承認権限が必要）
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

    if (canDecideExpense(session.role) === false) {
      throw new ForbiddenError()
    }

    const body = c.req.valid("json")

    const updated = await new DecideExpense(c).run({
      viewerRole: session.role,
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
