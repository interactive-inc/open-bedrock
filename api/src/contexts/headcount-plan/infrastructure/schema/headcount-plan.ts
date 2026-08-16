import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 人員計画（年度・部署ごとの計画人数。実在籍数との比較は API 側で active 数を添える）。 */
export const headcountPlans = sqliteTable(
  "headcount_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fiscalYear: integer("fiscal_year").notNull(),
    departmentCode: text("department_code"),
    plannedCount: integer("planned_count").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  // 同一年度・同一部署の二重登録を DB レベルで防ぐ。
  (table) => [
    uniqueIndex("uq_headcount_plans_year_department").on(table.fiscalYear, table.departmentCode),
  ],
)

export type HeadcountPlanRow = InferSelectModel<typeof headcountPlans>
