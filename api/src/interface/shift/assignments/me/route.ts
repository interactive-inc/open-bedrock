import { factory } from "@/lib/factory"
import { zAppShiftAssignmentList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { shiftAssignments } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, count, eq, gte, isNotNull, lte } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /shift/assignments/me — 本人の担当シフト一覧（日付範囲で絞り込み可能）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

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

    const conditions = [
      eq(shiftAssignments.employeeId, session.employeeId),
      isNotNull(shiftAssignments.publishedAt),
    ]

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
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(shiftAssignments)
      .where(and(...conditions))

    const responseBody = zAppShiftAssignmentList.parse({
      data: rows.map((row) => ({
        id: row.id,
        employee_id: row.employeeId,
        pattern_id: row.patternId,
        date: row.date,
        note: row.note,
        published_at: row.publishedAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
