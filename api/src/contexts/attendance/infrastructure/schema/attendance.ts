import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 勤怠記録（出勤・退勤の打刻と労働時間）。id は AUTOINCREMENT。 */
export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: text("id").primaryKey(),
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
    check("attendance_records_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_attendance_records_employee_open_unique")
      .on(table.employeeId)
      .where(sql`status = 'open'`),
  ],
)

export type AttendanceRecordRow = InferSelectModel<typeof attendanceRecords>
