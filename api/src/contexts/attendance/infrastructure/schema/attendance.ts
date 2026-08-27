import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 勤怠記録（出勤・退勤の打刻と労働時間）。id は AUTOINCREMENT。 */
export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    workDate: text("work_date").notNull(),
    clockInAt: text("clock_in_at"),
    clockOutAt: text("clock_out_at"),
    workMinutes: integer("work_minutes"),
    note: text("note"),
    status: text("status").notNull(),
  },
  // 打刻中(open)は 1 社員 1 件まで。clock-in の二重実行を DB レベルで弾く（TOCTOU 防止）。
  (table) => [
    uniqueIndex("idx_attendance_records_employee_open_unique")
      .on(table.employeeId)
      .where(sql`status = 'open'`),
  ],
)

export type AttendanceRecordRow = InferSelectModel<typeof attendanceRecords>
