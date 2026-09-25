import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 給与改定の履歴（基本給の改定・前回基本給・適用日） */
export const salaryRevisions = sqliteTable(
  "salary_revisions",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    effectiveDate: text("effective_date").notNull(),
    previousBaseSalary: integer("previous_base_salary").notNull(),
    newBaseSalary: integer("new_base_salary").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 同一社員・同一適用日の給与改定は 1 件まで（二重登録を防ぐ）。
  (table) => [
    check("salary_revisions_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("uq_salary_revisions_employee_date").on(table.employeeId, table.effectiveDate),
  ],
)

export type SalaryRevisionRow = InferSelectModel<typeof salaryRevisions>
