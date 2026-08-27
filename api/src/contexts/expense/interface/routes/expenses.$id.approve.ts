import { ApproveExpense } from "@/contexts/expense/application/approve-expense"
import { NotifyApprovalResult } from "@/api/http/notifications/notify-approval-result"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpenseDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
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

    const updated = await new ApproveExpense({
      context: c,
      notifyApprovalResult: (command) => new NotifyApprovalResult(c).run(command),
    }).execute({
      session: session,
      expenseId,
      approverId: session.employeeId,
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
