import { canDecideLeave } from "@/domain/leave/can-decide-leave"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { employees, leaveRequests } from "@/schema"
import { count, desc, eq } from "drizzle-orm"

// GET /leave/requests/inbox — 承認権限者向けの承認待ち一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideLeave(session.role) === false) {
    throw new ForbiddenError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const rows = await c.var.database
    .select({ leaveRequest: leaveRequests, applicantName: employees.name })
    .from(leaveRequests)
    .leftJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(eq(leaveRequests.status, "pending"))
    .orderBy(desc(leaveRequests.id))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(leaveRequests)
    .where(eq(leaveRequests.status, "pending"))

  const responseBody = rows.map((row) => ({
    id: row.leaveRequest.id,
    applicant_name: row.applicantName ?? "",
    leave_type: row.leaveRequest.leaveType,
    start_date: row.leaveRequest.startDate,
    end_date: row.leaveRequest.endDate,
    days: row.leaveRequest.days,
    reason: row.leaveRequest.reason,
    status: row.leaveRequest.status,
    created_at: row.leaveRequest.createdAt,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
