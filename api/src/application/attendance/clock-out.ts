import type { AttendanceRecord } from "@/domain/attendance/attendance-record"
import { toWorkMinutes } from "@/domain/attendance/to-work-minutes"
import type { Context } from "@/env"
import { AttendanceRecordRepository } from "@/infrastructure/attendance/attendance-record-repository"

export type Command = {
  employeeId: number
  now: string
  note: string | null
}

export type NotClockedIn = { reason: "not_clocked_in" }

export type AttendanceNotFound = { reason: "attendance_not_found" }

export type ClockInAtMissing = { reason: "clock_in_at_missing" }

/**
 * 退勤を打刻する。出勤中の記録に労働時間を確定する。
 */
export class ClockOut {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<AttendanceRecord | NotClockedIn | AttendanceNotFound | ClockInAtMissing | Error> {
    const recordRepository = new AttendanceRecordRepository(this.c)

    const open = await recordRepository.findOpenByEmployeeId(command.employeeId)

    if (open instanceof Error) {
      return open
    }

    if (open === null) {
      return { reason: "not_clocked_in" }
    }

    if (open.clockInAt === null) {
      return { reason: "clock_in_at_missing" }
    }

    const workMinutes = toWorkMinutes({
      clockInAt: open.clockInAt,
      clockOutAt: command.now,
    })

    if (workMinutes instanceof Error) {
      return workMinutes
    }

    const record = await recordRepository.update(
      open.withClosed({
        clockOutAt: command.now,
        workMinutes,
        note: command.note,
      }),
    )

    if (record instanceof Error) {
      return record
    }

    if (record === null) {
      return { reason: "attendance_not_found" }
    }

    return record
  }
}
