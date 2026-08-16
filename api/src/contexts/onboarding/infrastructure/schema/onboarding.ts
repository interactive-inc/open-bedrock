import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 入社/退職手続きのテンプレート（チェックリストの雛形） */
export const onboardingTemplates = sqliteTable("onboarding_templates", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  description: text("description"),
})

export type OnboardingTemplateRow = InferSelectModel<typeof onboardingTemplates>

/** テンプレートに含まれるタスク定義（並び順・担当ロール） */
export const onboardingTemplateTasks = sqliteTable(
  "onboarding_template_tasks",
  {
    templateCode: text("template_code").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ownerRole: text("owner_role"),
  },
  (table) => [primaryKey({ columns: [table.templateCode, table.code] })],
)

export type OnboardingTemplateTaskRow = InferSelectModel<typeof onboardingTemplateTasks>

/** 社員へのテンプレート割り当て（手続きの進行状態） */
export const onboardingAssignments = sqliteTable(
  "onboarding_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    templateCode: text("template_code").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    assignedAt: text("assigned_at").notNull(),
  },
  // 同一社員・同一テンプレートで未完了の割当は 1 件まで（重複割当を防ぐ）。
  (table) => [
    uniqueIndex("uq_onboarding_assignments_employee_template")
      .on(table.employeeId, table.templateCode)
      .where(sql`status != 'completed'`),
  ],
)

export type OnboardingAssignmentRow = InferSelectModel<typeof onboardingAssignments>

/** 割り当てから展開された個別タスク（完了状態） */
export const onboardingTasks = sqliteTable("onboarding_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignment_id").notNull(),
  templateTaskCode: text("template_task_code").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  status: text("status").notNull(),
  completedAt: text("completed_at"),
})

export type OnboardingTaskRow = InferSelectModel<typeof onboardingTasks>
