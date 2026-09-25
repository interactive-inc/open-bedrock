import { z } from "zod"
import type { PerformanceReviewRecordKind } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string> }>

export const performanceReviewSourceTables = {
  "evaluation-sheet-audit-log-record": {
    table: "evaluation_sheet_audit_logs",
    key: "id",
    columns: [
      "id",
      "legacy_id",
      "sheet_id",
      "actor_id",
      "action",
      "from_value",
      "to_value",
      "note",
      "created_at",
    ],
  },
  "evaluation-sheet-record": {
    table: "evaluation_sheets",
    key: "id",
    columns: [
      "id",
      "legacy_id",
      "employee_id",
      "template_id",
      "period",
      "status",
      "primary_evaluator_id",
      "secondary_evaluator_id",
      "submitted_at",
      "approved_at",
      "finalized_at",
      "created_at",
      "updated_at",
      "revision",
    ],
  },
  "evaluation-template-record": {
    table: "evaluation_templates",
    key: "id",
    columns: [
      "id",
      "legacy_id",
      "title",
      "period",
      "items",
      "status",
      "created_by",
      "created_at",
      "updated_at",
    ],
  },
  "goal-evaluation-record": {
    table: "goal_evaluations",
    key: "id",
    columns: [
      "id",
      "legacy_id",
      "goal_id",
      "evaluator_id",
      "kind",
      "score",
      "comment",
      "created_at",
    ],
  },
  "performance-goal-record": {
    table: "performance_goals",
    key: "id",
    columns: [
      "id",
      "created_at",
      "legacy_id",
      "employee_id",
      "period",
      "title",
      "kpi",
      "weight",
      "status",
      "owner_type",
      "parent_goal_id",
      "department_code",
      "evaluation_sheet_id",
    ],
  },
  "review-cycle-policy-record": {
    table: "review_cycle_policies",
    key: "cycle_id",
    columns: ["cycle_id", "policy_json"],
  },
  "review-cycle-record": {
    table: "review_cycles",
    key: "id",
    columns: ["id", "created_at", "legacy_id", "title", "period", "status", "due_date"],
  },
  "review-form-record": {
    table: "review_forms",
    key: "id",
    columns: [
      "id",
      "created_at",
      "legacy_id",
      "cycle_id",
      "subject_employee_id",
      "reviewer_employee_id",
      "reviewer_type",
      "answers",
      "score",
      "status",
      "submitted_at",
      "comment",
      "visibility",
    ],
  },
} as const satisfies Record<
  PerformanceReviewRecordKind,
  { table: string; key: string; columns: ReadonlyArray<string> }
>

/**
 * 原文の形式番号。版 2 は主キーを UUID へ移した後の原文で、移行前の整数の主キーを legacy_id として含める。
 */
export const PERFORMANCE_REVIEW_SNAPSHOT_FORMAT_VERSION = 2

/** 評価8台帳の現行全列を、元の版を創作せず形式番号付きの原文にする。 */
export function performanceReviewSnapshotQuery(
  recordKind: PerformanceReviewRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = z.uuid().safeParse(recordId)
  if (!parsed.success) return new Error("invalid performance review record id")
  const source = performanceReviewSourceTables[recordKind]
  const fields = source.columns.map((column) => `'${column}',${column}`).join(",")
  return {
    sql: `SELECT json_object('format','${recordKind}','version',${PERFORMANCE_REVIEW_SNAPSHOT_FORMAT_VERSION},'source',json_object(${fields})) AS snapshot_json FROM ${source.table} WHERE ${source.key}=?1`,
    values: [parsed.data],
  }
}
