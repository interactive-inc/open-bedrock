import { SubmitExpense } from "@/contexts/expense/application/submit-expense"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpense } from "@/contexts/expense/interface/http/response-schemas"
import { expenseCategorySchema } from "@/contexts/expense/domain/definitions/expense.definition"
import { isoDate } from "@/lib/validation/iso-date.schema"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/lib/http/errors"
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

    if (session === null || c.var.accountTokenVersion === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new SubmitExpense(c).run({
      accountId: session.accountId,
      tokenVersion: c.var.accountTokenVersion,
      attachmentIds: body.attachment_ids ?? [],
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
