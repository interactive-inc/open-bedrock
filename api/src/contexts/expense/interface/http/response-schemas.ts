import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import {
  expenseCategorySchema as expenseCategory,
  expenseStatusSchema as expenseStatus,
} from "@/contexts/expense/domain/definitions/expense.definition"
import { z } from "zod"

export const zAppExpense = z.object({
  id: z.number(),
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
  id: z.number(),
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
  id: z.number(),
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
  id: z.number(),
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
  id: z.number(),
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
  id: z.number(),
  organization_unit_id: zOrganizationUnitId,
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 部署予算一覧（GET /department-budgets）の 1 件。部署名を含む。 */
export const zAppBudgetListItem = z.object({
  id: z.number(),
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

/** 部署予算一覧（GET /department-budgets）のレスポンス。 */
export const zAppBudgetList = z.object({
  data: z.array(zAppBudgetListItem),
  total: z.number(),
})

/** 部署予算の詳細（GET /department-budgets/:id）。承認済み経費の消化額・残額を含む。 */
export const zAppBudgetDetail = z.object({
  id: z.number(),
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

/** 消化状況の横断ビュー（GET /department-budgets/summary）の 1 件。 */
export const zAppBudgetSummaryItem = z.object({
  organization_unit_id: zOrganizationUnitId,
  organization_unit_name: z.string().nullable(),
  fiscal_period: z.string(),
  budget_amount: z.number(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
})

/** 消化状況の横断ビュー（GET /department-budgets/summary）のレスポンス。 */
export const zAppBudgetSummary = z.object({
  fiscal_period: z.string(),
  data: z.array(zAppBudgetSummaryItem),
})
