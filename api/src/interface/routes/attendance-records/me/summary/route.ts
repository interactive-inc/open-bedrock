import { AttendanceRecord } from "@/domain/attendance/attendance-record.entity"
import { summarizeAttendance } from "@/interface/routes/attendance-records/me/summary/summarize-attendance"
import { toBusinessMonth } from "@/lib/to-business-month"
import { toMonthRange } from "@/interface/routes/attendance-records/to-month-range"
import { attendanceSummaryQuerySchema } from "@/interface/routes/attendance-records/me/summary/attendance-summary-query"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"
import { zAppAttendanceSummary } from "@/lib/app-schemas"
import { attendanceRecords } from "@/schema"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { BadRequestError, UnauthorizedError } from "@/interface/lib/errors"

// @authorization owner - 本人のリソースに限定する
/** GET /attendance-records/me/summary — 本人の指定月の勤怠集計（未指定なら現在月） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const parsed = attendanceSummaryQuerySchema.safeParse(c.req.query())

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const month = parsed.data.month ?? toBusinessMonth(c.env.NOW ?? new Date().toISOString())

  const range = toMonthRange(month)

  const rows = await c.var.database
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, session.employeeId),
        gte(attendanceRecords.workDate, range.from),
        lte(attendanceRecords.workDate, range.to),
      ),
    )
    .orderBy(asc(attendanceRecords.id))

  const records = rows.map((row) => AttendanceRecord.fromRow(row))

  const summary = summarizeAttendance({
    employeeId: session.employeeId,
    month: range.month,
    records,
  })

  const responseBody = zAppAttendanceSummary.parse({
    employee_id: summary.employeeId,
    month: summary.month,
    work_days: summary.workDays,
    total_work_minutes: summary.totalWorkMinutes,
  })

  return c.json(responseBody, 200)
})
