/** GET /department-budgets の各要素（部署予算一覧。部署名を含む）。 */
export type BudgetListItemResponse = {
  id: number
  department_id: number
  department_name: string | null
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
  department_id: number
  department_name: string | null
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

/** GET /department-budgets/summary の各要素（部署ごとの消化状況）。 */
export type BudgetSummaryItemResponse = {
  department_id: number
  department_name: string | null
  fiscal_period: string
  budget_amount: number
  consumed_amount: number
  remaining_amount: number
}

/** POST /department-budgets のリクエスト body。 */
export type BudgetCreateRequest = {
  department_id: number
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
  department_id: number
  fiscal_period: string
  period_start: string
  period_end: string
  amount: number
  name: string
  note: string | null
  created_at: string
}
