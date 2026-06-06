import { UpdateReward } from "@/application/thanks-points/update-reward"
import { canManageRewards } from "@/domain/thanks-points/can-manage-rewards"
import { toPositiveInt } from "@/domain/thanks-points/to-positive-int"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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
      name: z.string().min(1),
      point_cost: z.number(),
      stock: z.number().int().nonnegative().nullable(),
      is_active: z.boolean(),
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

    if (updated instanceof Error) {
      throw new InternalError("failed to update reward")
    }

    if ("reason" in updated) {
      if (updated.reason === "reward_not_found") {
        throw new NotFoundError("reward not found")
      }

      throw new BadRequestError("invalid reward")
    }

    return c.json(
      {
        id: updated.id,
        name: updated.name,
        point_cost: updated.pointCost,
        is_active: updated.isActive,
        stock: updated.stock,
        created_at: updated.createdAt,
      },
      200,
    )
  },
)
