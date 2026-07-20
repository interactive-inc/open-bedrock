/** GET /thanks/budget/me — 当月の贈与原資。 */
export type ThanksBudgetResponse = {
  period: string
  granted_points: number
  consumed_points: number
  remaining_points: number
}

/** GET /thanks/balance/me — 受領残高。 */
export type ThanksBalanceResponse = {
  balance_points: number
}

/** GET /thanks/rewards の各要素 / POST /thanks/rewards のレスポンス（交換カタログ）。 */
export type ThanksRewardResponse = {
  id: number | null
  name: string
  point_cost: number
  is_active: boolean
  stock: number | null
  created_at: string
}

/** GET /thanks/redemptions/me の各要素（自分の交換申請）。 */
export type ThanksRedemptionResponse = {
  id: number | null
  employee_id: number
  reward_id: number
  point_cost: number
  status: "pending" | "rejected" | "fulfilled"
  created_at: string
  decided_at: string | null
  decider_id: number | null
}

export type ThanksRedemptionInboxResponse = ThanksRedemptionResponse & {
  id: number
  employee_name: string
  employee_dept_name: string | null
  reward_name: string
}
