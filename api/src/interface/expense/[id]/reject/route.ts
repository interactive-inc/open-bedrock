import { DecideExpense } from "@/application/expense/decide-expense"
import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import { toExpenseId } from "@/domain/expense/to-expense-id"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"

// POST /expenses/:id/reject — 経費を却下する（承認権限が必要、コメント必須）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().min(1).max(3_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const expenseId = toExpenseId(c.req.param("id") ?? "")

    if (expenseId === null) {
      throw new BadRequestError("invalid expense id")
    }

    if (canDecideExpense(session.role) === false) {
      throw new ForbiddenError()
    }

    const body = c.req.valid("json")

    const updated = await new DecideExpense(c).run({
      viewerRole: session.role,
      expenseId,
      approverId: session.employeeId,
      action: "reject",
      comment: body.comment,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to reject expense")
    }

    if ("reason" in updated) {
      if (updated.reason === "already_decided") {
        throw new ConflictError("already decided")
      }
      if (updated.reason === "forbidden") {
        throw new ForbiddenError()
      }
      throw new NotFoundError("expense not found")
    }

    return c.json({ status: updated.status }, 200)
  },
)
