import { ListPendingRedemptions } from "@/application/thanks-points/list-pending-redemptions"
import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import { canDecideRedemption } from "@/domain/thanks-points/can-decide-redemption"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// GET /thanks/redemptions/inbox — 承認待ちの交換申請一覧（承認権限が必要）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideRedemption(session.role) === false) {
    throw new ForbiddenError()
  }

  const redemptions = await new ListPendingRedemptions(c).run()

  if (redemptions instanceof Error) {
    throw new InternalError("failed to load pending redemptions")
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
