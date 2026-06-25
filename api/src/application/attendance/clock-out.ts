import { AttendanceRecord } from "@/domain/attendance/attendance-record.entity"
import type { Context } from "@/env"
import { AttendanceRecordRepository } from "@/infrastructure/attendance/attendance-record-repository"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  employeeId: number
  now: string
  note?: string | null
}

/**
 * 退勤を打刻する。出勤中の記録に労働時間を確定する。
 */
export class ClockOut {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AttendanceRecord | ApplicationError> {
    const recordRepository = new AttendanceRecordRepository(this.c)

    const open = await recordRepository.findOpenByEmployeeId(command.employeeId)

    if (open instanceof Error) {
      return new UnexpectedError("failed to find attendance record", { cause: open })
    }

    if (open === null) {
      return new ConflictError("not clocked in", "not_clocked_in")
    }

    if (open.clockInAt === null) {
      return new ConflictError("clock-in time is missing", "clock_in_at_missing")
    }

    const workMinutes = AttendanceRecord.toWorkMinutes({
      clockInAt: open.clockInAt,
      clockOutAt: command.now,
    })

    if (workMinutes instanceof Error) {
      return new UnexpectedError("failed to calculate work minutes", { cause: workMinutes })
    }

    const record = await recordRepository.update(
      open.withClosed({
        clockOutAt: command.now,
        workMinutes,
        note: command.note,
      }),
    )

    if (record instanceof Error) {
      return new UnexpectedError("failed to update attendance record", { cause: record })
    }

    if (record === null) {
      return new ConflictError("already clocked out", "already_clocked_out")
    }

    return record
  }
}
