import { AttendanceRecord } from "@/domain/attendance/attendance-record"
import type { Context } from "@/env"
import { AttendanceRecordRepository } from "@/infrastructure/attendance/attendance-record-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  employeeId: number
  now: string
  note: string | null
}

export type AlreadyClockedIn = { reason: "already_clocked_in" }

/**
 * 出勤を打刻する。既に出勤中なら判別可能な失敗を返す。
 */
export class ClockIn {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AttendanceRecord | AlreadyClockedIn | Error> {
    const recordRepository = new AttendanceRecordRepository(this.c)

    const open = await recordRepository.findOpenByEmployeeId(command.employeeId)

    if (open instanceof Error) {
      return open
    }

    if (open !== null) {
      return { reason: "already_clocked_in" }
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
      return { reason: "already_clocked_in" }
    }

    if (record instanceof Error) {
      return record
    }

    return record
  }
}
