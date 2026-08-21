import { AttendanceRecord } from "@/contexts/attendance/domain/attendance-record.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"
import { attendanceRecords } from "@/contexts/attendance/infrastructure/schema/attendance"
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
          note: attendanceRecord.note,
          status: attendanceRecord.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert attendance record")
        : AttendanceRecord.fromRow(row)
    } catch (error) {
      // (employee_id) WHERE status = 'open' の UNIQUE 索引違反 = 二重打刻。
      // 型付きで返し、application 層が再読込に依存せず重複として扱えるようにする。
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("employee already has an open attendance record", {
          cause: error,
        })
      }

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
          note: attendanceRecord.note,
          status: attendanceRecord.status,
        })
        .where(
          and(eq(attendanceRecords.id, attendanceRecord.id), eq(attendanceRecords.status, "open")),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : AttendanceRecord.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update attendance record")
    }
  }
}
