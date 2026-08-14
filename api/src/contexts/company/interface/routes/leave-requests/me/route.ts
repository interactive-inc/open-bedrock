import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zAppLeaveRequestSummaryList } from "@/lib/app-schemas"
import { leaveRequests } from "@/schema"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { and, count, desc, eq } from "drizzle-orm"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /leave-requests/me — 本人の休暇申請一覧（status で絞り込み可能） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
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

    const conditions = [eq(leaveRequests.employeeId, session.employeeId)]

    if (query.status !== undefined) {
      conditions.push(eq(leaveRequests.status, query.status))
    }

    const rows = await c.var.database
      .select()
      .from(leaveRequests)
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.id))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(leaveRequests)
      .where(and(...conditions))

    const responseBody = zAppLeaveRequestSummaryList.parse({
      data: rows.map((row) => ({
        id: row.id,
        leave_type: row.leaveType,
        start_date: row.startDate,
        end_date: row.endDate,
        days: row.days,
        unit: row.unit,
        hours: row.hours,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
