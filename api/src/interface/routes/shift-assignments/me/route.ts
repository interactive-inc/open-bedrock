import { factory } from "@/interface/utils/factory"
import { zAppMyShiftAssignmentList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { shiftAssignments, shiftPatterns } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, count, eq, gte, inArray, isNotNull, lte } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

/**
 * GET /shift-assignments/me — 本人の担当シフト一覧（日付範囲で絞り込み可能）。
 * member はパターン一覧（/shift/patterns）を閲覧できないため、割当にパターン名・時間帯を埋めて返す。
 */
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

    const patternIds = rows
      .map((row) => row.patternId)
      .filter((patternId): patternId is number => patternId !== null)

    const patternRows =
      patternIds.length === 0
        ? []
        : await c.var.database
            .select()
            .from(shiftPatterns)
            .where(inArray(shiftPatterns.id, patternIds))

    const patternById = new Map(patternRows.map((pattern) => [pattern.id, pattern]))

    const responseBody = zAppMyShiftAssignmentList.parse({
      data: rows.map((row) => {
        const pattern = row.patternId === null ? undefined : patternById.get(row.patternId)

        return {
          id: row.id,
          employee_id: row.employeeId,
          pattern_id: row.patternId,
          pattern_name: pattern?.name ?? null,
          pattern_start_time: pattern?.startTime ?? null,
          pattern_end_time: pattern?.endTime ?? null,
          date: row.date,
          note: row.note,
          published_at: row.publishedAt,
        }
      }),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
