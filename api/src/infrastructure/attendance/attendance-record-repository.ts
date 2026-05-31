import { AttendanceRecord } from "@/domain/attendance/attendance-record"
import type { Context } from "@/env"
import { attendanceRecords } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export class AttendanceRecordRepository {
  constructor(private readonly c: Context) {}

  async findOpenByEmployeeId(employeeId: number): Promise<AttendanceRecord | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(attendanceRecords)
        .where(
          and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.status, "open")),
        )
        .orderBy(asc(attendanceRecords.id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : AttendanceRecord.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load attendance_record")
    }
  }

  async create(attendanceRecord: AttendanceRecord): Promise<AttendanceRecord | Error> {
    try {
      const rows = await this.c.var.database
        .insert(attendanceRecords)
        .values({
          employeeId: attendanceRecord.employeeId,
          workDate: attendanceRecord.workDate,
          clockInAt: attendanceRecord.clockInAt,
          clockOutAt: attendanceRecord.clockOutAt,
          workMinutes: attendanceRecord.workMinutes,
          overtimeMinutes: attendanceRecord.overtimeMinutes,
          note: attendanceRecord.note,
          status: attendanceRecord.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert attendance record")
        : AttendanceRecord.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert attendance record")
    }
  }

  async update(attendanceRecord: AttendanceRecord): Promise<AttendanceRecord | null | Error> {
    try {
      if (attendanceRecord.id === null) {
        return new Error("cannot update unsaved attendance record")
      }

      const rows = await this.c.var.database
        .update(attendanceRecords)
        .set({
          clockOutAt: attendanceRecord.clockOutAt,
          workMinutes: attendanceRecord.workMinutes,
          overtimeMinutes: attendanceRecord.overtimeMinutes,
          status: attendanceRecord.status,
        })
        .where(eq(attendanceRecords.id, attendanceRecord.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : AttendanceRecord.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update attendance record")
    }
  }
}
