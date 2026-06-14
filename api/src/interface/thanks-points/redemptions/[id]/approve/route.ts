import { DecideRedemption } from "@/application/thanks-points/decide-redemption"
import { canDecideRedemption } from "@/lib/thanks-points/can-decide-redemption"
import { toPositiveInt } from "@/lib/thanks-points/to-positive-int"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// POST /thanks/redemptions/:id/approve — 交換申請を承認・確定する（承認権限が必要）
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideRedemption(session.role) === false) {
    throw new ForbiddenError()
  }

  const redemptionId = toPositiveInt(c.req.param("id") ?? "")

  if (redemptionId === null) {
    throw new BadRequestError("invalid redemption id")
  }

  const result = await new DecideRedemption(c).run({
    redemptionId,
    deciderId: session.employeeId,
    action: "approve",
    decidedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to approve redemption")
  }

  if ("reason" in result) {
    if (result.reason === "redemption_not_found") {
      throw new NotFoundError("redemption not found")
    }

    if (result.reason === "already_decided") {
      throw new ConflictError("redemption already decided")
    }

    if (result.reason === "insufficient_balance") {
      throw new ConflictError("insufficient balance")
    }

    if (result.reason === "self_approval_forbidden") {
      throw new ForbiddenError("cannot approve own redemption")
    }

    // 交換は確定済みだが在庫減算だけ失敗。確定は巻き戻さず、追跡できるよう構造化ログを残し
    // レスポンスにも stock_warning を立てて運用側が手当てできるようにする（握りつぶさない）。
    console.error(
      JSON.stringify({
        event: "thanks_redemption_stock_decrement_failed",
        redemption_id: result.redemption.id,
        reward_id: result.redemption.rewardId,
        message: result.stockError.message,
      }),
    )

    return c.json(
      { id: result.redemption.id, status: result.redemption.status, stock_warning: true },
      200,
    )
  }

  return c.json({ id: result.id, status: result.status, stock_warning: false }, 200)
})
