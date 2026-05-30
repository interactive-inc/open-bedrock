import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { shiftAssignments } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, eq, gte, lte } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /shift/assignments/me — 本人の担当シフト一覧（日付範囲で絞り込み可能）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const conditions = [eq(shiftAssignments.employeeId, session.employeeId)]

    if (query.from !== undefined) {
      conditions.push(gte(shiftAssignments.date, query.from))
    }

    if (query.to !== undefined) {
      conditions.push(lte(shiftAssignments.date, query.to))
    }

    const rows = await c.var.database
      .select()
      .from(shiftAssignments)
      .where(and(...conditions))
      .orderBy(shiftAssignments.id)

    const responseBody = rows.map((row) => ({
      id: row.id,
      employee_id: row.employeeId,
      pattern_id: row.patternId,
      date: row.date,
      note: row.note,
      published_at: row.publishedAt,
    }))

    return c.json(responseBody, 200)
  },
)
