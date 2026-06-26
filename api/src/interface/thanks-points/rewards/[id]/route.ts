import { UpdateReward } from "@/application/thanks-points/update-reward"
import { canManageRewards } from "@/lib/thanks-points/can-manage-rewards"
import { toPositiveInt } from "@/lib/thanks-points/to-positive-int"
import { rewardPointCostSchema } from "@/domain/thanks-points/thanks-reward.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksReward } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// PATCH /thanks/rewards/:id — 交換カタログを更新する（管理者向け）
export const PATCH = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      point_cost: rewardPointCostSchema,
      stock: z.number().int().nonnegative().nullable(),
      is_active: z.boolean(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canManageRewards(session) === false) {
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
      stock: json.stock,
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
