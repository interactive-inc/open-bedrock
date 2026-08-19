import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 異動・在籍イベント履歴（入社・異動・休職・復職・退職。判定は持たず事実の記録のみ） */
export const employeeEvents = sqliteTable("employee_events", {
  id: integer("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  kind: text("kind").notNull(),
  effectiveDate: text("effective_date").notNull(),
  fromDepartmentCode: text("from_department_code"),
  toDepartmentCode: text("to_department_code"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
})

export type EmployeeEventRow = InferSelectModel<typeof employeeEvents>
