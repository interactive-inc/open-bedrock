import { AttendanceRecord } from "@/contexts/company/domain/attendance/attendance-record.entity"
import type { Context } from "@/env"
import { AttendanceRecordRepository } from "@/contexts/company/infrastructure/attendance/attendance-record-repository"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  employeeId: number
  now: string
  note: string | null
}

/**
 * 出勤を打刻する。既に出勤中なら判別可能な失敗を返す。
 */
export class ClockIn {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AttendanceRecord | ApplicationError> {
    const recordRepository = new AttendanceRecordRepository(this.c)

    const open = await recordRepository.findOpenByEmployeeId(command.employeeId)

    if (open instanceof Error) {
      return new UnexpectedError("failed to find attendance record", { cause: open })
    }

    if (open !== null) {
      return new ConflictError("already clocked in", "already_clocked_in")
    }

    const record = await recordRepository.create(
      AttendanceRecord.create({
        employeeId: command.employeeId,
        clockInAt: command.now,
        note: command.note,
      }),
    )

    // attendance_records の UNIQUE 索引は (employee_id) WHERE status = 'open' のみ。
    // insert の UNIQUE 違反は二重打刻と確定できるため、再読込に依存せず重複を返す（TOCTOU 競合対策）。
    if (record instanceof UniqueConstraintError) {
      return new ConflictError("already clocked in", "already_clocked_in")
    }

    if (record instanceof Error) {
      return new UnexpectedError("failed to create attendance record", { cause: record })
    }

    return record
  }
}
