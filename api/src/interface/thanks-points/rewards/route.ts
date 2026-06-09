import { CreateReward } from "@/application/thanks-points/create-reward"
import { ListRewards } from "@/application/thanks-points/list-rewards"
import { canManageRewards } from "@/domain/thanks-points/can-manage-rewards"
import { rewardPointCostSchema } from "@/domain/thanks-points/thanks-reward"
import type { ThanksReward } from "@/domain/thanks-points/thanks-reward"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// GET /thanks/rewards — 交換カタログ一覧。管理者は無効なものも見える。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rewards = await new ListRewards(c).run({
    activeOnly: canManageRewards(session.role) === false,
  })

  if (rewards instanceof Error) {
    throw new InternalError("failed to load rewards")
  }

  return c.json(rewards.map(toRewardResponse), 200)
})

// POST /thanks/rewards — 交換カタログを登録する（管理者向け）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      point_cost: rewardPointCostSchema,
      stock: z.number().int().nonnegative().nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canManageRewards(session.role) === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const created = await new CreateReward(c).run({
      name: json.name,
      pointCost: json.point_cost,
      stock: json.stock ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create reward")
    }

    if ("reason" in created) {
      throw new BadRequestError("invalid reward")
    }

    return c.json(toRewardResponse(created), 201)
  },
)

// カタログ集約を snake_case のレスポンスへ写す。
function toRewardResponse(reward: ThanksReward) {
  return {
    id: reward.id,
    name: reward.name,
    point_cost: reward.pointCost,
    is_active: reward.isActive,
    stock: reward.stock,
    created_at: reward.createdAt,
  }
}
