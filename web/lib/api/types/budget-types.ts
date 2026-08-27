/** GET /department-budgets の各要素（組織単位別の予算一覧。組織名を含む）。 */
export type BudgetListItemResponse = {
  id: number
  organization_unit_id: string
  organization_unit_name: string | null
  fiscal_period: string
  period_start: string
  period_end: string
  amount: number
  name: string
  note: string | null
  created_at: string
}

/** GET /department-budgets/:id のレスポンス（消化額・残額を含む予算詳細）。 */
export type BudgetDetailResponse = {
  id: number
  organization_unit_id: string
  organization_unit_name: string | null
  fiscal_period: string
  period_start: string
  period_end: string
  amount: number
  name: string
  note: string | null
  consumed_amount: number
  remaining_amount: number
  created_at: string
}

/** GET /department-budgets/summary の各要素（組織単位ごとの消化状況）。 */
export type BudgetSummaryItemResponse = {
  organization_unit_id: string
  organization_unit_name: string | null
  fiscal_period: string
  budget_amount: number
  consumed_amount: number
  remaining_amount: number
}

/** POST /department-budgets のリクエスト body。 */
export type BudgetCreateRequest = {
  organization_unit_id: string
  fiscal_period: string
  period_start: string
  period_end: string
  amount: number
  name: string
  note?: string
}

/** PATCH /department-budgets/:id のリクエスト body。 */
export type BudgetUpdateRequest = {
  amount: number
  name: string
  note: string | null
}

/** POST /department-budgets・PATCH /department-budgets/:id のレスポンス（作成・更新後の予算。api は snake_case で返す）。 */
export type BudgetMutatedResponse = {
  id: number | null
  organization_unit_id: string
  fiscal_period: string
  period_start: string
  period_end: string
  amount: number
  name: string
  note: string | null
  created_at: string
}
