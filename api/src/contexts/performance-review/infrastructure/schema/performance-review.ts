import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 評価サイクル（多面評価の実施単位・期間・状態） */
export const reviewCycles = sqliteTable(
  "review_cycles",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    period: text("period").notNull(),
    status: text("status").notNull(),
    dueDate: text("due_date"),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("review_cycles_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type ReviewCycleRow = InferSelectModel<typeof reviewCycles>

/** 評価フォーム（サイクル・被評価者・評価者ごとの回答とスコア・状態）。answers は JSON 文字列で保存される。 */
export const reviewForms = sqliteTable(
  "review_forms",
  {
    id: text("id").primaryKey().notNull(),
    cycleId: text("cycle_id").notNull(),
    subjectEmployeeId: text("subject_employee_id").$type<EmployeeId>().notNull(),
    reviewerEmployeeId: text("reviewer_employee_id").$type<EmployeeId>().notNull(),
    reviewerType: text("reviewer_type").notNull(),
    answers: text("answers").notNull(),
    score: integer("score"),
    comment: text("comment"),
    status: text("status").notNull(),
    submittedAt: text("submitted_at"),
    // 開示制御。hidden は被評価者本人に非公開、disclosed で本人閲覧可。既存行は disclosed 互換。
    visibility: text("visibility").notNull().default("disclosed"),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("review_forms_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type ReviewFormRow = InferSelectModel<typeof reviewForms>

/** 評価サイクルの方針（評価サイクルの 1:1 の拡張。主キーは評価サイクルの UUID）。 */
export const reviewCyclePolicies = sqliteTable(
  "review_cycle_policies",
  {
    cycleId: text("cycle_id").primaryKey().notNull(),
    policyJson: text("policy_json").notNull(),
  },
  () => [check("review_cycle_policies_cycle_id_uuid", sql.raw(uuidCheckPredicate("cycle_id")))],
)

export type ReviewCyclePolicyRow = InferSelectModel<typeof reviewCyclePolicies>

/**
 * 評価テンプレート（期間ごとの評価項目雛形）。items は JSON 配列で保存する。
 * status は draft（下書き）→ active（運用中）→ archived（廃止）の遷移をとる。
 */
export const evaluationTemplates = sqliteTable(
  "evaluation_templates",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    period: text("period").notNull(),
    items: text("items").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").$type<EmployeeId>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("evaluation_templates_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_evaluation_templates_period").on(table.period),
    index("idx_evaluation_templates_status").on(table.status),
  ],
)

export type EvaluationTemplateRow = InferSelectModel<typeof evaluationTemplates>

/**
 * 評価シート（評価期 × 社員。MBO の中心エンティティ）。
 * primary/secondary_evaluator_id はシート作成時にcanonical Company snapshotから解決して固定する。
 * 異動後も評価期間中は変わらない。HR/admin のみ手動変更可（audit_log 記録）。
 */
export const evaluationSheets = sqliteTable(
  "evaluation_sheets",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    templateId: text("template_id"),
    period: text("period").notNull(),
    status: text("status").notNull().default("draft"),
    primaryEvaluatorId: text("primary_evaluator_id").$type<EmployeeId>().notNull(),
    secondaryEvaluatorId: text("secondary_evaluator_id").$type<EmployeeId>(),
    submittedAt: text("submitted_at"),
    approvedAt: text("approved_at"),
    finalizedAt: text("finalized_at"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("evaluation_sheets_id_uuid", sql.raw(uuidCheckPredicate("id"))),
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
    id: text("id").primaryKey().notNull(),
    sheetId: text("sheet_id").notNull(),
    actorId: text("actor_id").$type<EmployeeId>().notNull(),
    action: text("action").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("evaluation_sheet_audit_logs_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_evaluation_sheet_audit_logs_sheet").on(table.sheetId),
  ],
)

export type EvaluationSheetAuditLogRow = InferSelectModel<typeof evaluationSheetAuditLogs>
