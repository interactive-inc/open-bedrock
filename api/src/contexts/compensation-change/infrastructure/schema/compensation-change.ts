import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 給与改定の履歴（基本給の改定・前回基本給・適用日） */
export const salaryRevisions = sqliteTable(
  "salary_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    effectiveDate: text("effective_date").notNull(),
    previousBaseSalary: integer("previous_base_salary").notNull(),
    newBaseSalary: integer("new_base_salary").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  // 同一社員・同一適用日の給与改定は 1 件まで（二重登録を防ぐ）。
  (table) => [
    uniqueIndex("uq_salary_revisions_employee_date").on(table.employeeId, table.effectiveDate),
  ],
)

export type SalaryRevisionRow = InferSelectModel<typeof salaryRevisions>
