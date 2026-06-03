import { resolveAttendanceSearchQuery } from "@/domain/attendance/resolve-attendance-search-query"
import { attendanceListQuerySchema } from "@/interface/attendance/attendance-list-query"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { attendanceRecords } from "@/schema"
import type { SQL } from "drizzle-orm"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"

// GET /attendance — 勤怠検索（他人の閲覧は権限ロールのみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const parsed = attendanceListQuerySchema.safeParse(c.req.query())

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const requestedEmployeeId =
    parsed.data.employee_id === undefined ? null : Number(parsed.data.employee_id)

  const query = resolveAttendanceSearchQuery({
    requestedEmployeeId,
    from: parsed.data.from ?? null,
    to: parsed.data.to ?? null,
    viewerEmployeeId: session.employeeId,
    viewerRole: session.role,
  })

  if ("reason" in query) {
    throw new ForbiddenError()
  }

  const conditions: Array<SQL> = []

  if (query.employeeId !== null) {
    conditions.push(eq(attendanceRecords.employeeId, query.employeeId))
  }

  if (query.from !== null) {
    conditions.push(gte(attendanceRecords.workDate, query.from))
  }

  if (query.to !== null) {
    conditions.push(lte(attendanceRecords.workDate, query.to))
  }

  const rows = await c.var.database
    .select()
    .from(attendanceRecords)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(asc(attendanceRecords.id))

  const responseBody = rows.map((row) => ({
    id: row.id,
    employee_id: row.employeeId,
    work_date: row.workDate,
    clock_in_at: row.clockInAt,
    clock_out_at: row.clockOutAt,
    work_minutes: row.workMinutes,
    status: row.status,
  }))

  return c.json(responseBody, 200)
})
