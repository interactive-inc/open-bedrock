import { UnexpectedError } from "@/lib/errors"
import { ThanksRewardRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-reward.repository"
import { CreateReward } from "@/contexts/thanks/application/thanks-points/create-reward"
import { rewardPointCostSchema } from "@/contexts/thanks/domain/thanks-points/thanks-reward.entity"
import type { ThanksReward } from "@/contexts/thanks/domain/thanks-points/thanks-reward.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksReward, zAppThanksRewardList } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { thanksRewards } from "@/contexts/thanks/infrastructure/schema/thanks"
import { count, eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /thanks-rewards — 交換カタログ一覧。管理者は無効なものも見える。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const isActiveOnly = session.hasPermission("thanks_reward:manage") === false

  const rewards = await (async () => {
    const props = {
      activeOnly: isActiveOnly,
      limit,
      offset,
    }

    const rewardRepository = new ThanksRewardRepository(c)

    const rewards = await rewardRepository.findMany({
      activeOnly: props.activeOnly,
      limit: props.limit,
      offset: props.offset,
    })

    if (rewards instanceof Error) {
      return new UnexpectedError("failed to find rewards", { cause: rewards })
    }

    return rewards
  })()

  if (rewards instanceof ApplicationError) {
    throw toHttpException(rewards)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(thanksRewards)
    .where(isActiveOnly ? eq(thanksRewards.isActive, true) : undefined)

  const responseBody = zAppThanksRewardList.parse({
    data: rewards.map(toRewardResponse),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization permission - 権限キーで判定する
/** POST /thanks-rewards — 交換カタログを登録する（管理者向け） */
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

    if (session.hasPermission("thanks_reward:manage") === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const created = await new CreateReward(c).run({
      name: json.name,
      pointCost: json.point_cost,
      stock: json.stock ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppThanksReward.parse(toRewardResponse(created))

    return c.json(responseBody, 201)
  },
)

/** カタログ集約を snake_case のレスポンスへ写す。 */
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
