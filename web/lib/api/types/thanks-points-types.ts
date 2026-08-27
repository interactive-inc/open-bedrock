/** GET /thanks-point-budgets/me — 当月の贈与原資（今月あと何点送れるか）。毎月リセットされる。 */
export type ThanksBudgetResponse = {
  period: string
  granted_points: number
  consumed_points: number
  remaining_points: number
}

/** GET /thanks-point-balances/me — 受領残高（もらった点数の累積から交換分を引いた残り）。 */
export type ThanksBalanceResponse = {
  balance_points: number
}

/** GET /thanks-rewards の各要素 / POST /thanks-rewards のレスポンス（交換カタログ）。 */
export type ThanksRewardResponse = {
  id: number | null
  name: string
  point_cost: number
  is_active: boolean
  stock: number | null
  created_at: string
}

/** GET /thanks-redemptions/me の各要素（自分の交換申請）。 */
export type ThanksRedemptionResponse = {
  id: number | null
  employee_id: string
  reward_id: number
  point_cost: number
  status: "pending" | "rejected" | "fulfilled"
  created_at: string
  decided_at: string | null
  decider_id: string | null
}

export type ThanksRedemptionInboxResponse = ThanksRedemptionResponse & {
  id: number
  employee_name: string
  employee_dept_name: string | null
  reward_name: string
}
