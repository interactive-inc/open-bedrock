import { ListMyRedemptions } from "@/application/thanks-points/list-my-redemptions"
import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// GET /thanks/redemptions/me — 自分の交換申請の一覧（新しい順）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const redemptions = await new ListMyRedemptions(c).run({ employeeId: session.employeeId })

  if (redemptions instanceof Error) {
    throw new InternalError("failed to load redemptions")
  }

  return c.json(redemptions.map(toRedemptionResponse), 200)
})

// 交換申請集約を snake_case のレスポンスへ写す。
function toRedemptionResponse(redemption: ThanksRedemption) {
  return {
    id: redemption.id,
    employee_id: redemption.employeeId,
    reward_id: redemption.rewardId,
    point_cost: redemption.pointCost,
    status: redemption.status,
    created_at: redemption.createdAt,
    decided_at: redemption.decidedAt,
    decider_id: redemption.deciderId,
  }
}
