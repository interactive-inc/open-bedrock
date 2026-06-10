import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { expenses } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, eq } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// GET /expenses/me — 本人の経費一覧（status で絞り込み可能）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected", "settled"]).optional(),
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

    const rows = await c.var.database
      .select()
      .from(expenses)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)

    const body = rows.map((row) => ({
      id: row.id,
      category: row.category,
      amount: row.amount,
      spent_at: row.spentAt,
      status: row.status,
      created_at: row.createdAt,
    }))

    return c.json(body, 200)
  },
)
