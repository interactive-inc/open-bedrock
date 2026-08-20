import { AttachExpenseAttachments } from "@/contexts/expense/application/attach-expense-attachments"
import { SubmitExpense } from "@/contexts/expense/application/submit-expense"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpense } from "@/lib/app-schemas"
import { expenseCategorySchema, isoDate } from "@/lib/schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** POST /expenses — 本人の経費を申請する（submit = create） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      category: expenseCategorySchema,
      amount: z.number().positive().int().safe(),
      spent_at: isoDate,
      note: z.string().max(3_000).optional(),
      attachment_ids: z.array(z.string().min(1).max(64)).max(10).optional(),
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

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const attached = await new AttachExpenseAttachments(c).run({
      expenseId: created.id ?? 0,
      attachmentIds: body.attachment_ids ?? [],
      ownerAccountId: String(session.accountId),
      now: c.var.now(),
    })

    if (attached instanceof ApplicationError) {
      throw toHttpException(attached)
    }

    const responseBody = zAppExpense.parse({
      id: created.id,
      employee_id: created.employeeId,
      category: created.category,
      amount: created.amount,
      spent_at: created.spentAt,
      note: created.note,
      status: created.status,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
