import { UpdateReward } from "@/contexts/company/application/thanks-points/update-reward"
import { toPositiveInt } from "@/contexts/company/interface/utils/to-positive-int"
import { rewardPointCostSchema } from "@/contexts/company/domain/thanks-points/thanks-reward.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksReward } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** PATCH /thanks-rewards/:id — 交換カタログを更新する（管理者向け） */
export const PATCH = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      point_cost: rewardPointCostSchema,
      is_active: z.boolean(),
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

    const rewardId = toPositiveInt(c.req.param("id") ?? "")

    if (rewardId === null) {
      throw new BadRequestError("invalid reward id")
    }

    const json = c.req.valid("json")

    const updated = await new UpdateReward(c).run({
      rewardId,
      name: json.name,
      pointCost: json.point_cost,
      isActive: json.is_active,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppThanksReward.parse({
      id: updated.id,
      name: updated.name,
      point_cost: updated.pointCost,
      is_active: updated.isActive,
      stock: updated.stock,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
