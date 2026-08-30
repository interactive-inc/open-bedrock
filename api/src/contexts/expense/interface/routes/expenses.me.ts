import { factory } from "@/api/http/factory"
import { zAppExpenseMineList } from "@/contexts/expense/interface/http/response-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { expenseStatusSchema } from "@/contexts/expense/domain/definitions/expense.definition"
import { verifyBearer } from "@/api/http/verify-bearer"
import { expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { zValidator } from "@hono/zod-validator"
import { and, count, desc, eq } from "drizzle-orm"
import { UnauthorizedError } from "@/lib/http/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /expenses/me — 本人の経費一覧（status で絞り込み可能） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: expenseStatusSchema.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const conditions = [eq(expenses.employeeId, session.employeeId)]

    if (query.status !== undefined) {
      conditions.push(eq(expenses.status, query.status))
    }

    const [rows, totalRows] = await Promise.all([
      c.var.database
        .select()
        .from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.id))
        .limit(limit)
        .offset(offset),
      c.var.database
        .select({ total: count() })
        .from(expenses)
        .where(and(...conditions)),
    ])

    const responseBody = zAppExpenseMineList.parse({
      data: rows.map((row) => ({
        id: row.id,
        category: row.category,
        amount: row.amount,
        spent_at: row.spentAt,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
