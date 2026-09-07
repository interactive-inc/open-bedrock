import { SubmitExpenseProcedure } from "@/contexts/expense/application/submit-expense-procedure"
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

// @authorization service - 現在の本人資格・提出権限と確認した経費内容を保存時にも検査する
/** POST /expenses — 本人の経費を申請する（会社規程へ提出する） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      request_key: z.string().uuid(),
      existing_expense_id: z.number().int().positive().safe().nullable().optional(),
      previous_expense_id: z.number().int().positive().safe().nullable().optional(),
      category: expenseCategorySchema,
      amount: z.number().positive().int().safe(),
      spent_at: isoDate,
      note: z.string().max(3_000).nullable().optional(),
      attachment_ids: z.array(z.string().min(1).max(64)).max(10).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null || c.var.accountTokenVersion === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const submitted = await new SubmitExpenseProcedure(c).run({
      requestKey: body.request_key,
      existingExpenseId: body.existing_expense_id ?? null,
      previousExpenseId: body.previous_expense_id ?? null,
      session,
      tokenVersion: c.var.accountTokenVersion,
      attachmentIds: body.attachment_ids ?? [],
      category: body.category,
      amount: body.amount,
      spentAt: body.spent_at,
      note: body.note ?? null,
      createdAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (submitted instanceof ApplicationError) {
      throw toHttpException(submitted)
    }

    const created = submitted.request
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

    return c.json(responseBody, submitted.replayed ? 200 : 201)
  },
)
