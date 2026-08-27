import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"

export type AttendanceSummary = {
  employeeId: EmployeeId
  month: string
  workDays: number
  totalWorkMinutes: number
}

export type Props = {
  employeeId: EmployeeId
  month: string
  records: ReadonlyArray<AttendanceRecord>
}

/** 退勤済み(closed)の記録だけを合算して月次の勤怠集計を組む純粋関数。 */
export function summarizeAttendance(props: Props): AttendanceSummary {
  let workDays = 0

  let totalWorkMinutes = 0

  for (const record of props.records) {
    if (record.status === "closed") {
      workDays = workDays + 1

      totalWorkMinutes = totalWorkMinutes + (record.workMinutes ?? 0)
    }
  }

  return {
    employeeId: props.employeeId,
    month: props.month,
    workDays,
    totalWorkMinutes,
  }
}
