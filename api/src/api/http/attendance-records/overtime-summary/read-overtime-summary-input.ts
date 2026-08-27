import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { attendanceRecords } from "@/contexts/attendance/infrastructure/schema/attendance"
import { companyCalendarDays } from "@/contexts/company-calendar/infrastructure/schema/company-calendar"
import type { Context } from "@/env"
import { and, gte, inArray, lte } from "drizzle-orm"

/** Attendance実績とCompany Calendar例外を同じ月範囲で読み出す。 */
export async function readOvertimeSummaryInput(
  context: Context,
  input: Readonly<{
    from: string
    to: string
    employeeIds: ReadonlyArray<EmployeeId> | null
  }>,
) {
  const attendanceConditions = [
    gte(attendanceRecords.workDate, input.from),
    lte(attendanceRecords.workDate, input.to),
  ]
  if (input.employeeIds !== null) {
    attendanceConditions.push(inArray(attendanceRecords.employeeId, [...input.employeeIds]))
  }

  const [rows, overrideRows] = await Promise.all([
    context.var.database
      .select({
        employeeId: attendanceRecords.employeeId,
        workMinutes: attendanceRecords.workMinutes,
      })
      .from(attendanceRecords)
      .where(and(...attendanceConditions)),
    context.var.database
      .select({
        calendarDate: companyCalendarDays.calendarDate,
        kind: companyCalendarDays.kind,
      })
      .from(companyCalendarDays)
      .where(
        and(
          gte(companyCalendarDays.calendarDate, input.from),
          lte(companyCalendarDays.calendarDate, input.to),
        ),
      ),
  ])

  return { rows, overrideRows }
}
