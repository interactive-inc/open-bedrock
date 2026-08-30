import { attendanceSearchQuerySchema } from "@/contexts/attendance/interface/http/attendance-records/me/attendance-search-query"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { zAppAttendanceRecordList } from "@/contexts/attendance/interface/http/response-schemas"
import { attendanceRecords } from "@/contexts/attendance/infrastructure/schema/attendance"
import type { SQL } from "drizzle-orm"
import { and, asc, count, eq, gte, lte } from "drizzle-orm"
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors"

// @authorization owner - 本人のリソースに限定する
/** GET /attendance-records/me — 本人の勤怠記録一覧（employee_id は無視して本人に固定） */
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

  const limit = toBoundedInt({
    raw: parsed.data.limit,
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: parsed.data.offset,
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select()
      .from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(asc(attendanceRecords.id))
      .limit(limit)
      .offset(offset),
    c.var.database
      .select({ total: count() })
      .from(attendanceRecords)
      .where(and(...conditions)),
  ])

  const responseBody = zAppAttendanceRecordList.parse({
    data: rows.map((row) => ({
      id: row.id,
      employee_id: row.employeeId,
      work_date: row.workDate,
      clock_in_at: row.clockInAt,
      clock_out_at: row.clockOutAt,
      work_minutes: row.workMinutes,
      status: row.status,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
