import { AttendanceRecordSourceFrozenError } from "@/contexts/attendance/infrastructure/repositories/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import type { AttendanceRecordRepository } from "@/contexts/attendance/infrastructure/repositories/attendance-record.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  employeeId: EmployeeId
  now: string
  note: string | null
}

type Context = Readonly<{
  recordRepository: Pick<AttendanceRecordRepository, "findOpenByEmployeeId" | "create">
}>

/**
 * 出勤を打刻する。既に出勤中なら判別可能な失敗を返す。
 */
export class ClockIn {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<AttendanceRecord | ApplicationError> {
    const open = await this.c.recordRepository.findOpenByEmployeeId(command.employeeId)

    if (open instanceof Error) {
      return new UnexpectedError("failed to find attendance record", { cause: open })
    }

    if (open !== null) {
      return new ConflictError("already clocked in", "already_clocked_in")
    }

    const record = await this.c.recordRepository.create(
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

    if (record instanceof AttendanceRecordSourceFrozenError) {
      return new ConflictError(
        "Attendance record writes are frozen for preservation",
        "attendance_record_source_frozen",
      )
    }

    if (record instanceof Error) {
      return new UnexpectedError("failed to create attendance record", { cause: record })
    }

    return record
  }
}
