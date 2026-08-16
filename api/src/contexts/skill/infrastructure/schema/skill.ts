import type { InferSelectModel } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** スキルマスタ（コード・表示名・カテゴリ） */
export const skills = sqliteTable("skill_definitions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
})

export type SkillRow = InferSelectModel<typeof skills>

/** 従業員ごとの登録スキル（レベル・経験年数・補足） */
export const employeeSkills = sqliteTable(
  "employee_skills",
  {
    employeeId: integer("employee_id").notNull(),
    skillCode: text("skill_code").notNull(),
    level: integer("level").notNull(),
    years: integer("years"),
    note: text("note"),
  },
  (table) => [primaryKey({ columns: [table.employeeId, table.skillCode] })],
)

export type EmployeeSkillRow = InferSelectModel<typeof employeeSkills>
