import { expenseCategorySchema } from "@/contexts/expense/domain/definitions/expense.definition"
import { isoDate } from "@/lib/validation/iso-date.schema"
import { zExpenseProcedureView } from "@/contexts/expense/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { ExpenseProcedureListAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-list.adapter"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"

// @authorization service - 全社の経費には専用の閲覧権限を要求する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z
        .enum([
          "pending",
          "approved",
          "rejected",
          "returned",
          "cancelled",
          "awaiting_execution",
          "settled",
        ])
        .optional(),
      category: expenseCategorySchema.optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      applicant_id: zEmployeeId.optional(),
      sort: z.enum(["created_at_desc", "created_at_asc", "amount_desc", "amount_asc"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const query = c.req.valid("query")
    const result = await new ExpenseProcedureListAdapter(c).list({
      session,
      tokenVersion: c.var.accountTokenVersion,
      at: new Date(c.env.NOW ?? Date.now()),
      mode: "admin",
      status: query.status ?? null,
      category: query.category ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
      applicantId: query.applicant_id ?? null,
      sort: query.sort ?? "created_at_desc",
      limit: toBoundedInt({
        raw: query.limit,
        fallback: DEFAULT_LIST_LIMIT,
        min: 1,
        max: MAX_LIST_LIMIT,
      }),
      offset: toBoundedInt({ raw: query.offset, fallback: 0, min: 0, max: MAX_LIST_OFFSET }),
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json(
      { data: result.data.map((view) => zExpenseProcedureView.parse(view)), total: result.total },
      200,
    )
  },
)
