import { SubmitExpense } from "@/application/expense/submit-expense"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// POST /expenses — 本人の経費を申請する（submit = create）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      category: z.enum(["transport", "supplies", "entertainment", "books", "other"]),
      amount: z.number().positive().int().safe(),
      spent_at: z.string().min(1),
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new SubmitExpense(c).run({
      employeeId: session.employeeId,
      category: body.category,
      amount: body.amount,
      spentAt: body.spent_at,
      note: body.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof Error) {
      throw new InternalError("failed to submit expense")
    }

    const responseBody = {
      id: created.id,
      employee_id: created.employeeId,
      category: created.category,
      amount: created.amount,
      spent_at: created.spentAt,
      note: created.note,
      status: created.status,
      created_at: created.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
