import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { GoalTreeNode } from "@/contexts/performance-review/domain/definitions/goal-tree-node.definition"
import { z } from "zod"

/** 目標の所有主体。 */
export const zAppGoalOwnerType = z.enum(["individual", "department", "company"])

/** 目標 1 件のレスポンス。 */
export const zAppGoal = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
  owner_type: zAppGoalOwnerType.default("individual"),
  parent_goal_id: z.number().nullable().default(null),
  department_code: z.string().nullable().default(null),
  evaluation_sheet_id: z.number().nullable().default(null),
})

/** 目標一覧のレスポンス。 */
export const zAppGoalList = z.object({
  data: z.array(zAppGoal),
  total: z.number(),
})

/** 目標評価 1 件のレスポンス。 */
export const zAppGoalEvaluation = z.object({
  id: z.number(),
  goal_id: z.number(),
  evaluator_id: zEmployeeId,
  kind: z.string(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  created_at: z.string(),
})

/** 目標評価一覧のレスポンス。ページネーションなしのためフラット配列で返す。 */
export const zAppGoalEvaluationList = z.array(zAppGoalEvaluation)

/** 目標ツリーのノード 1 件（children で再帰）。全社を根、部門を中間、個人目標を葉とする。 */
export const zAppGoalTreeNode: z.ZodType<GoalTreeNode> = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
  owner_type: zAppGoalOwnerType,
  parent_goal_id: z.number().nullable(),
  department_code: z.string().nullable(),
  children: z.array(z.lazy(() => zAppGoalTreeNode)),
})

/** 目標ツリーのレスポンス（全社目標などのルートノード配列）。 */
export const zAppGoalTree = z.object({
  period: z.string().nullable(),
  roots: z.array(zAppGoalTreeNode),
})

/** 評価テンプレートの項目。 */
export const zAppEvaluationTemplateItem = z.object({
  title: z.string(),
  default_weight: z.number(),
  kpi_example: z.string().nullable().optional(),
})

/** 評価テンプレート 1 件のレスポンス。 */
export const zAppEvaluationTemplate = z.object({
  id: z.number(),
  title: z.string(),
  period: z.string(),
  items: z.array(zAppEvaluationTemplateItem),
  status: z.string(),
  created_by: zEmployeeId,
  created_at: z.string(),
  updated_at: z.string(),
})

/** 評価テンプレート一覧のレスポンス。 */
export const zAppEvaluationTemplateList = z.object({
  data: z.array(zAppEvaluationTemplate),
  total: z.number(),
})

/** 評価シート 1 件のレスポンス。 */
export const zAppEvaluationSheet = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  template_id: z.number().nullable(),
  period: z.string(),
  status: z.string(),
  primary_evaluator_id: zEmployeeId,
  secondary_evaluator_id: zEmployeeId.nullable(),
  submitted_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  finalized_at: z.string().nullable(),
  revision: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

/** 評価シート一覧のレスポンス。 */
export const zAppEvaluationSheetList = z.object({
  data: z.array(zAppEvaluationSheet),
  total: z.number(),
})

/** 評価サイクル 1 件のレスポンス。 */
export const zAppReviewCycle = z.object({
  id: z.number(),
  title: z.string(),
  period: z.string(),
  status: z.string(),
  due_date: z.string().nullable(),
})

/** 評価サイクル一覧のレスポンス。 */
export const zAppReviewCycleList = z.object({
  data: z.array(zAppReviewCycle),
  total: z.number(),
})

/**
 * 評価期間ラベルの一覧レスポンス。
 *
 * 期間の選択肢を必要とする画面（目標の作成・編集・絞り込みなど）のための read model。
 * サイクルの title / status / due_date は返さない。まだ open していないサイクルの
 * 表題や締切を全従業員へ広げずに、期間ラベルだけを共有するため。
 */
export const zAppReviewPeriodList = z.object({
  data: z.array(z.string()),
})

/** 評価フォーム 1 件のレスポンス。submit は comment を含む。 */
export const zAppReviewForm = z.object({
  id: z.number(),
  cycle_id: z.number(),
  subject_employee_id: zEmployeeId,
  reviewer_employee_id: zEmployeeId,
  reviewer_type: z.string(),
  answers: z.array(z.unknown()),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  status: z.string(),
  submitted_at: z.string().nullable(),
  visibility: z.string(),
})

/** 評価フォーム一覧（comment を含まない）の要素。 */
export const zAppReviewFormSummary = z.object({
  id: z.number(),
  cycle_id: z.number(),
  subject_employee_id: zEmployeeId,
  reviewer_employee_id: zEmployeeId,
  reviewer_type: z.string(),
  answers: z.array(z.unknown()),
  score: z.number().nullable(),
  status: z.string(),
  submitted_at: z.string().nullable(),
  visibility: z.string(),
})

/** 自分宛て評価フォーム一覧のレスポンス。 */
export const zAppReviewFormList = z.object({
  data: z.array(zAppReviewFormSummary),
  total: z.number(),
})

/** 評価者種別ごとの提出状況（360度評価の集計）。 */
export const zAppReviewerTypeSummary = z.object({
  reviewer_type: z.string(),
  form_count: z.number(),
  submitted_count: z.number(),
})

/** 被評価者ごとの評価結果サマリのレスポンス。 */
export const zAppReviewResultForm = zAppReviewFormSummary.extend({
  reviewer_employee_id: zEmployeeId.nullable(),
})

export const zAppReviewResult = z.object({
  cycle_id: z.number(),
  subject_employee_id: zEmployeeId,
  form_count: z.number(),
  submitted_count: z.number(),
  average_score: z.number().nullable(),
  reviewer_type_summary: z.array(zAppReviewerTypeSummary),
  forms: z.array(zAppReviewResultForm),
})

/** 評価フォーム一括作成のレスポンス。作成された件数と各フォーム。 */
export const zAppReviewFormBulkResult = z.object({
  created_count: z.number(),
  forms: z.array(zAppReviewFormSummary),
})

/** サイクル一括開示のレスポンス。 */
export const zAppReviewDiscloseResult = z.object({
  cycle_id: z.number(),
  disclosed_count: z.number(),
})
