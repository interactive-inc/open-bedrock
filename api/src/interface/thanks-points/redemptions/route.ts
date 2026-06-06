import { RequestRedemption } from "@/application/thanks-points/request-redemption"
import { toPositiveInt } from "@/domain/thanks-points/to-positive-int"
import {
  BadRequestError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /thanks/redemptions — 受領残高から交換を申請する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      reward_id: z.number(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const rewardId = toPositiveInt(json.reward_id)

    if (rewardId === null) {
      throw new BadRequestError("invalid reward id")
    }

    const result = await new RequestRedemption(c).run({
      employeeId: session.employeeId,
      rewardId,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof Error) {
      throw new InternalError("failed to request redemption")
    }

    if ("reason" in result) {
      if (result.reason === "reward_not_found") {
        throw new NotFoundError("reward not found")
      }

      if (result.reason === "insufficient_balance") {
        throw new ConflictError("insufficient balance")
      }

      if (result.reason === "out_of_stock") {
        throw new ConflictError("reward out of stock")
      }

      throw new BadRequestError("reward is not available")
    }

    return c.json(
      {
        id: result.id,
        employee_id: result.employeeId,
        reward_id: result.rewardId,
        point_cost: result.pointCost,
        status: result.status,
        created_at: result.createdAt,
        decided_at: result.decidedAt,
        decider_id: result.deciderId,
      },
      201,
    )
  },
)
