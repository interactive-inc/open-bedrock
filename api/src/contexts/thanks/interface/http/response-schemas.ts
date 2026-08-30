import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== thanks ===== */
export const zAppThanks = z.object({
  id: z.number().nullable(),
  sender_employee_id: zEmployeeId,
  sender_name: z.string(),
  recipient_employee_id: zEmployeeId,
  recipient_name: z.string(),
  message: z.string(),
  points: z.number(),
  created_at: z.string(),
})

export const zAppThanksList = z.object({
  data: z.array(zAppThanks),
  total: z.number(),
})

/** Thanks ポイントの交換カタログ 1 件のレスポンス。 */
export const zAppThanksReward = z.object({
  id: z.number(),
  name: z.string(),
  point_cost: z.number(),
  is_active: z.boolean(),
  stock: z.number().nullable(),
  created_at: z.string(),
})

/** 交換カタログ一覧のレスポンス。 */
export const zAppThanksRewardList = z.object({
  data: z.array(zAppThanksReward),
  total: z.number(),
})

/** Thanks ポイントの交換申請 1 件のレスポンス。 */
export const zAppThanksRedemption = z.object({
  id: z.number().nullable(),
  employee_id: zEmployeeId,
  reward_id: z.number(),
  point_cost: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  decider_id: zEmployeeId.nullable(),
})

/** 交換申請一覧のレスポンス。 */
export const zAppThanksRedemptionList = z.object({
  data: z.array(zAppThanksRedemption),
  total: z.number(),
})

/** 交換申請の承認・却下の決定結果。stock_warning は承認時のみ含まれる。 */
export const zAppThanksRedemptionDecision = z.object({
  id: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  stock_warning: z.boolean().optional(),
})

/** 全社サンクス交換申請一覧（GET /thanks-redemptions/admin）の 1 件。申請者名・景品名を含む。 */
export const zAppThanksRedemptionAdminItem = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  employee_name: z.string(),
  employee_dept_name: z.string().nullable(),
  reward_id: z.number(),
  reward_name: z.string(),
  point_cost: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  decider_id: zEmployeeId.nullable(),
})

/** 全社サンクス交換申請一覧のレスポンス。 */
export const zAppThanksRedemptionAdminList = z.object({
  data: z.array(zAppThanksRedemptionAdminItem),
  total: z.number(),
})

/** 自分の受領残高のレスポンス。 */
export const zAppThanksBalance = z.object({
  balance_points: z.number(),
})

/** 自分の当月の贈与原資のレスポンス。 */
export const zAppThanksBudget = z.object({
  period: z.string(),
  granted_points: z.number(),
  consumed_points: z.number(),
  remaining_points: z.number(),
})
