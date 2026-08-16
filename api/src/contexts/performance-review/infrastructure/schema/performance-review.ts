import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 評価サイクル（多面評価の実施単位・期間・状態） */
export const reviewCycles = sqliteTable("review_cycles", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  period: text("period").notNull(),
  status: text("status").notNull(),
  dueDate: text("due_date"),
})

export type ReviewCycleRow = InferSelectModel<typeof reviewCycles>

/** 評価フォーム（サイクル・被評価者・評価者ごとの回答とスコア・状態）。answers は JSON 文字列で保存される。 */
export const reviewForms = sqliteTable("review_forms", {
  id: integer("id").primaryKey(),
  cycleId: integer("cycle_id").notNull(),
  subjectEmployeeId: integer("subject_employee_id").notNull(),
  reviewerEmployeeId: integer("reviewer_employee_id").notNull(),
  reviewerType: text("reviewer_type").notNull(),
  answers: text("answers").notNull(),
  score: integer("score"),
  comment: text("comment"),
  status: text("status").notNull(),
  submittedAt: text("submitted_at"),
  // 開示制御。hidden は被評価者本人に非公開、disclosed で本人閲覧可。既存行は disclosed 互換。
  visibility: text("visibility").notNull().default("disclosed"),
})

export type ReviewFormRow = InferSelectModel<typeof reviewForms>

export const reviewCyclePolicies = sqliteTable("review_cycle_policies", {
  cycleId: integer("cycle_id").primaryKey(),
  policyJson: text("policy_json").notNull(),
})

export type ReviewCyclePolicyRow = InferSelectModel<typeof reviewCyclePolicies>

/**
 * 評価テンプレート（期間ごとの評価項目雛形）。items は JSON 配列で保存する。
 * status は draft（下書き）→ active（運用中）→ archived（廃止）の遷移をとる。
 */
export const evaluationTemplates = sqliteTable(
  "evaluation_templates",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    period: text("period").notNull(),
    items: text("items").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: integer("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_evaluation_templates_period").on(table.period),
    index("idx_evaluation_templates_status").on(table.status),
  ],
)

export type EvaluationTemplateRow = InferSelectModel<typeof evaluationTemplates>

/**
 * 評価シート（評価期 × 社員。MBO の中心エンティティ）。
 * primary/secondary_evaluator_id はシート作成時に org_memberships から解決して固定する。
 * 異動後も評価期間中は変わらない。HR/admin のみ手動変更可（audit_log 記録）。
 */
export const evaluationSheets = sqliteTable(
  "evaluation_sheets",
  {
    id: integer("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    templateId: integer("template_id"),
    period: text("period").notNull(),
    status: text("status").notNull().default("draft"),
    primaryEvaluatorId: integer("primary_evaluator_id").notNull(),
    secondaryEvaluatorId: integer("secondary_evaluator_id"),
    submittedAt: text("submitted_at"),
    approvedAt: text("approved_at"),
    finalizedAt: text("finalized_at"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_evaluation_sheets_employee").on(table.employeeId),
    index("idx_evaluation_sheets_period").on(table.period),
    index("idx_evaluation_sheets_status").on(table.status),
    uniqueIndex("uq_evaluation_sheets_employee_period").on(table.employeeId, table.period),
  ],
)

export type EvaluationSheetRow = InferSelectModel<typeof evaluationSheets>

/** 評価シートの監査ログ（操作の事実記録）。 */
export const evaluationSheetAuditLogs = sqliteTable(
  "evaluation_sheet_audit_logs",
  {
    id: integer("id").primaryKey(),
    sheetId: integer("sheet_id").notNull(),
    actorId: integer("actor_id").notNull(),
    action: text("action").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_evaluation_sheet_audit_logs_sheet").on(table.sheetId)],
)

export type EvaluationSheetAuditLogRow = InferSelectModel<typeof evaluationSheetAuditLogs>
