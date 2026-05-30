import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { leaveRequests } from "@/schema"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// GET /leave/requests/me — 本人の休暇申請一覧（status で絞り込み可能）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const conditions = [eq(leaveRequests.employeeId, session.employeeId)]

    if (query.status !== undefined) {
      conditions.push(eq(leaveRequests.status, query.status))
    }

    const rows = await c.var.database
      .select()
      .from(leaveRequests)
      .where(and(...conditions))

    const responseBody = rows.map((row) => ({
      id: row.id,
      leave_type: row.leaveType,
      start_date: row.startDate,
      end_date: row.endDate,
      days: row.days,
      status: row.status,
      created_at: row.createdAt,
    }))

    return c.json(responseBody, 200)
  },
)
