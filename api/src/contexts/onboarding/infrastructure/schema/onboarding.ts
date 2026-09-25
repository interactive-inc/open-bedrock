import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { personnelActions } from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import { systemDeliveryTableReferences } from "@system/interface/operations/system-delivery-table-references"

/** 入社/退職手続きのテンプレート（チェックリストの雛形） */
export const onboardingTemplates = sqliteTable(
  "onboarding_templates",
  {
    id: text("id").primaryKey().notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    description: text("description"),
  },
  () => [check("onboarding_templates_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type OnboardingTemplateRow = InferSelectModel<typeof onboardingTemplates>

/** 入社・退職の発令ごとに自動で割り当てるテンプレートの設定 */
export const onboardingLifecycleTemplateBindings = sqliteTable(
  "onboarding_lifecycle_template_bindings",
  {
    id: text("id").primaryKey().notNull(),
    effectType: text("effect_type").notNull().unique().$type<"hire" | "retired">(),
    templateCode: text("template_code").notNull(),
    updatedAt: integer("updated_at").notNull(),
    updatedByAccountId: text("updated_by_account_id").$type<AccountId>(),
  },
  () => [
    check("onboarding_lifecycle_template_bindings_id_uuid", sql.raw(uuidCheckPredicate("id"))),
  ],
)

/** テンプレートに含まれるタスク定義（並び順・担当ロール） */
export const onboardingTemplateTasks = sqliteTable(
  "onboarding_template_tasks",
  {
    id: text("id").primaryKey().notNull(),
    templateCode: text("template_code").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ownerRole: text("owner_role"),
  },
  (table) => [
    check("onboarding_template_tasks_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    unique().on(table.templateCode, table.code),
  ],
)

export type OnboardingTemplateTaskRow = InferSelectModel<typeof onboardingTemplateTasks>

/** 社員へのテンプレート割り当て（手続きの進行状態） */
export const onboardingAssignments = sqliteTable(
  "onboarding_assignments",
  {
    id: text("id").primaryKey().notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    templateCode: text("template_code").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    assignedAt: text("assigned_at").notNull(),
    lifecycleActionId: text("lifecycle_action_id").references(() => personnelActions.id, {
      onDelete: "restrict",
    }),
  },
  // 同一社員・同一テンプレートで進行中の割当は 1 件まで（完了済みと置換済みは除く）。
  (table) => [
    check("onboarding_assignments_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("onboarding_assignments_lifecycle_action_uniq").on(table.lifecycleActionId),
    uniqueIndex("uq_onboarding_assignments_employee_template")
      .on(table.employeeId, table.templateCode)
      .where(sql`status NOT IN ('completed', 'superseded')`),
  ],
)

export type OnboardingAssignmentRow = InferSelectModel<typeof onboardingAssignments>

/** 割り当てから展開された個別タスク（完了状態） */
export const onboardingTasks = sqliteTable(
  "onboarding_tasks",
  {
    id: text("id").primaryKey().notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    assignmentId: text("assignment_id").notNull(),
    templateTaskCode: text("template_task_code").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull(),
    completedAt: text("completed_at"),
  },
  () => [check("onboarding_tasks_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type OnboardingTaskRow = InferSelectModel<typeof onboardingTasks>

export const onboardingLifecycleDeliveries = sqliteTable(
  "onboarding_lifecycle_deliveries",
  {
    jobId: text("job_id")
      .primaryKey()
      .notNull()
      .references(systemDeliveryTableReferences.jobId, { onDelete: "restrict" }),
    actionId: text("action_id")
      .notNull()
      .references(() => personnelActions.id, { onDelete: "restrict" }),
    createdAt: integer("created_at").notNull(),
    outcome: text("outcome", { enum: ["assigned", "superseded", "obsolete"] }),
    assignmentId: text("assignment_id").references(() => onboardingAssignments.id, {
      onDelete: "restrict",
    }),
    processedAt: integer("processed_at"),
  },
  (table) => [
    check("onboarding_lifecycle_deliveries_job_id_uuid", sql.raw(uuidCheckPredicate("job_id"))),
    index("onboarding_lifecycle_deliveries_action_idx").on(table.actionId, table.createdAt),
    check("onboarding_lifecycle_delivery_created_at", sql`${table.createdAt} >= 0`),
    check(
      "onboarding_lifecycle_delivery_processed_at",
      sql`${table.processedAt} IS NULL OR ${table.processedAt} >= ${table.createdAt}`,
    ),
    check(
      "onboarding_lifecycle_delivery_outcome",
      sql`(${table.outcome} IS NULL AND ${table.processedAt} IS NULL AND ${table.assignmentId} IS NULL)
    OR (${table.outcome} IS NOT NULL AND ${table.outcome} = 'assigned' AND ${table.processedAt} IS NOT NULL AND ${table.assignmentId} IS NOT NULL)
    OR (${table.outcome} IS NOT NULL AND ${table.outcome} IN ('superseded', 'obsolete') AND ${table.processedAt} IS NOT NULL AND ${table.assignmentId} IS NULL)`,
    ),
  ],
)
