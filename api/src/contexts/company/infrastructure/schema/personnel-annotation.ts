import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 移行元の人事注記。確定した発令へ読み替えず原記録を保持する */
export const personnelAnnotations = sqliteTable("company_personnel_annotations", {
  id: integer("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  kind: text("kind").notNull(),
  effectiveDate: text("effective_date").notNull(),
  fromDepartmentCode: text("from_department_code"),
  toDepartmentCode: text("to_department_code"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
})

export type PersonnelAnnotationRow = InferSelectModel<typeof personnelAnnotations>
