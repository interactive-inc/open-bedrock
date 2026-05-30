import { AttendanceRecord } from "@/domain/attendance/attendance-record"
import type { Context } from "@/env"
import { AttendanceRecordRepository } from "@/infrastructure/attendance/attendance-record-repository"

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

    if (record instanceof Error) {
      return record
    }

    return record
  }
}
