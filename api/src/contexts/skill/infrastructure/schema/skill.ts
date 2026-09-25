import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"

/** スキルマスタ（コード・表示名・カテゴリ） */
export const skills = sqliteTable(
  "skill_definitions",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
  },
  () => [check("skill_definitions_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type SkillRow = InferSelectModel<typeof skills>

/** 従業員ごとの登録スキル（レベル・経験年数・補足） */
export const employeeSkills = sqliteTable(
  "employee_skills",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    skillCode: text("skill_code").notNull(),
    level: integer("level").notNull(),
    years: integer("years"),
    note: text("note"),
  },
  (table) => [
    check("employee_skills_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    unique().on(table.employeeId, table.skillCode),
  ],
)

export type EmployeeSkillRow = InferSelectModel<typeof employeeSkills>
