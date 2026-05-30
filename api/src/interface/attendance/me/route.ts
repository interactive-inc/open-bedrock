import { attendanceSearchQuerySchema } from "@/interface/attendance/me/attendance-search-query"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { attendanceRecords } from "@/schema"
import type { SQL } from "drizzle-orm"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { BadRequestError, UnauthorizedError } from "@/interface/lib/errors"

// GET /attendance/me — 本人の勤怠記録一覧（employee_id は無視して本人に固定）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const parsed = attendanceSearchQuerySchema.safeParse(c.req.query())

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const conditions: Array<SQL> = [eq(attendanceRecords.employeeId, session.employeeId)]

  if (parsed.data.from !== undefined) {
    conditions.push(gte(attendanceRecords.workDate, parsed.data.from))
  }

  if (parsed.data.to !== undefined) {
    conditions.push(lte(attendanceRecords.workDate, parsed.data.to))
  }

  const rows = await c.var.database
    .select()
    .from(attendanceRecords)
    .where(and(...conditions))
    .orderBy(asc(attendanceRecords.id))

  const responseBody = rows.map((row) => ({
    id: row.id,
    employee_id: row.employeeId,
    work_date: row.workDate,
    clock_in_at: row.clockInAt,
    clock_out_at: row.clockOutAt,
    work_minutes: row.workMinutes,
    overtime_minutes: row.overtimeMinutes,
    status: row.status,
  }))

  return c.json(responseBody, 200)
})
