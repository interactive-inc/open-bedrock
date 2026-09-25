import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import {
  expenseCategorySchema as expenseCategory,
  expenseStatusSchema as expenseStatus,
} from "@/contexts/expense/domain/definitions/expense.definition"
import { z } from "zod"

export const zAppExpense = z.object({
  id: z.uuid(),
  employee_id: zEmployeeId,
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: expenseStatus,
  created_at: z.string(),
})

/** 経費詳細のレスポンス（申請者名を含む）。 */
export const zAppExpenseDetail = z.object({
  id: z.uuid(),
  employee_id: zEmployeeId,
  applicant_name: z.string(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: expenseStatus,
  created_at: z.string(),
  attachments: z.array(
    z.object({
      id: z.string(),
      file_name: z.string(),
      content_type: z.string(),
      byte_size: z.number(),
    }),
  ),
})

/** 本人の経費一覧の 1 件。 */
export const zAppExpenseMineItem = z.object({
  id: z.uuid(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  status: expenseStatus,
  created_at: z.string(),
})

/** 本人の経費一覧のレスポンス。 */
export const zAppExpenseMineList = z.object({
  data: z.array(zAppExpenseMineItem),
  total: z.number(),
})

/** 承認待ち経費一覧の 1 件（申請者名を含む）。 */
export const zAppExpenseInboxItem = z.object({
  id: z.uuid(),
  applicant_name: z.string(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  status: expenseStatus,
  created_at: z.string(),
})

/** 承認待ち経費一覧のレスポンス。 */
export const zAppExpenseInboxList = z.object({
  data: z.array(zAppExpenseInboxItem),
  total: z.number(),
})

/** 経費の承認・却下結果（status のみ）。 */
export const zAppExpenseDecision = z.object({
  status: expenseStatus,
})

/** 全社経費申請一覧（GET /expenses/admin）の 1 件。 */
export const zAppExpenseAdminItem = z.object({
  id: z.uuid(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  status: expenseStatus,
  created_at: z.string(),
})

/** 全社経費申請一覧（GET /expenses/admin）のレスポンス。 */
export const zAppExpenseAdminList = z.object({
  data: z.array(zAppExpenseAdminItem),
  total: z.number(),
})

/** 部署予算 1 件のレスポンス。 */
export const zAppBudget = z.object({
  id: z.uuid(),
  organization_unit_id: zOrganizationUnitId,
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 部署予算一覧（GET /expense-budgets）の 1 件。部署名を含む。 */
export const zAppBudgetListItem = z.object({
  id: z.uuid(),
  organization_unit_id: zOrganizationUnitId,
  organization_unit_name: z.string().nullable(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 部署予算一覧（GET /expense-budgets）のレスポンス。 */
export const zAppBudgetList = z.object({
  data: z.array(zAppBudgetListItem),
  total: z.number(),
})

/** 部署予算の詳細（GET /expense-budgets/:id）。承認済み経費の消化額・残額を含む。 */
export const zAppBudgetDetail = z.object({
  id: z.uuid(),
  organization_unit_id: zOrganizationUnitId,
  organization_unit_name: z.string().nullable(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
  created_at: z.string(),
})

/** 消化状況の横断ビュー（GET /expense-budgets/summary）の 1 件。 */
export const zAppBudgetSummaryItem = z.object({
  organization_unit_id: zOrganizationUnitId,
  organization_unit_name: z.string().nullable(),
  fiscal_period: z.string(),
  budget_amount: z.number(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
})

/** 消化状況の横断ビュー（GET /expense-budgets/summary）のレスポンス。 */
export const zAppBudgetSummary = z.object({
  fiscal_period: z.string(),
  data: z.array(zAppBudgetSummaryItem),
})

/** 同じ案件から取得する経費の内容・操作資格・判断対象。 */
export const zExpenseProcedureView = zAppExpenseDetail.extend({
  status: z.enum([
    "pending",
    "approved",
    "rejected",
    "returned",
    "cancelled",
    "awaiting_execution",
    "settled",
  ]),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  applicant_id: zEmployeeId,
  organization_unit_id: zOrganizationUnitId,
  organization_unit_name: z.string().nullable(),
  evidence_available: z.boolean(),
  attachments: z.array(
    z.object({
      id: z.string(),
      file_name: z.string(),
      content_type: z.string(),
      byte_size: z.number(),
      sha256: z.string().nullable(),
    }),
  ),
  procedure_required: z.boolean(),
  application_id: z.number().int().positive().nullable(),
  previous_expense_id: z.uuid().nullable(),
  decision_target: z
    .object({
      proposal_version: z.number().int().positive(),
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      task_key: z.string().min(1),
      task_round: z.number().int().positive(),
    })
    .nullable(),
  next_expense_id: z.uuid().nullable(),
  can_submit_legacy: z.boolean(),
  can_decide: z.boolean(),
  can_execute: z.boolean(),
  can_cancel: z.boolean(),
  can_resubmit: z.boolean(),
  required_approvals: z.number().int().positive().nullable(),
  approvals: z.number().int().nonnegative(),
  decisions: z.array(
    z.object({
      id: z.string(),
      task_key: z.string(),
      task_round: z.number().int().positive(),
      action: z.enum(["approve", "reject", "return"]),
      comment: z.string().nullable(),
      decided_at: z.string(),
    }),
  ),
})

/** 経費の書込み停止世代。全記録の保全完了や撤去許可を意味しない。 */
export const zAppExpenseSourceFreeze = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppExpenseCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  recordKind: expenseRecordKindSchema,
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppExpenseRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(expenseRecordKindSchema),
  createdAt: z.iso.datetime(),
})

export const zAppExpenseRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
