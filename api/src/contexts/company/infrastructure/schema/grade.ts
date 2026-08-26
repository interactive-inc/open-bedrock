import type { InferSelectModel } from "drizzle-orm"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 等級マスタ（並び順の rank を持つ等級の定義。判定・計算は持たず定義のみ） */
export const grades = sqliteTable(
  "company_grade_definitions",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  // 等級コードは全社で一意（同一コードの二重登録を防ぐ）。
  (table) => [uniqueIndex("uq_company_grade_definitions_code").on(table.code)],
)

export type GradeRow = InferSelectModel<typeof grades>

/** 等級の割当履歴（社員ごとに、いつからどの等級か。事実の記録のみ） */
export const employeeGrades = sqliteTable(
  "company_employee_grades",
  {
    id: integer("id").primaryKey(),
    employeeId: text("employee_id").notNull().$type<EmployeeId>(),
    gradeId: integer("grade_id").notNull(),
    effectiveDate: text("effective_date").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  // 同一社員・同一発効日の割当の重複を DB レベルで防ぐ。
  (table) => [
    uniqueIndex("uq_company_employee_grades_employee_effective_date").on(
      table.employeeId,
      table.effectiveDate,
    ),
  ],
)

export type EmployeeGradeRow = InferSelectModel<typeof employeeGrades>
