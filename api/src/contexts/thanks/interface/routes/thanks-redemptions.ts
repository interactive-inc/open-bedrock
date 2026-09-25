import { RequestRedemption } from "@/contexts/thanks/application/thanks-points/request-redemption"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import { ThanksRewardRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-reward.repository"
import { uuidSchema } from "@/lib/validation/uuid.schema"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksRedemption } from "@/contexts/thanks/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** POST /thanks-redemptions — 受領残高から交換を申請する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      reward_id: z.string(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const rewardId = uuidSchema.safeParse(json.reward_id).data ?? null

    if (rewardId === null) {
      throw new BadRequestError("invalid reward id")
    }

    const result = await new RequestRedemption({
      rewardRepository: new ThanksRewardRepository(c),
      redemptionRepository: new ThanksRedemptionRepository(c),
    }).run({
      employeeId: session.employeeId,
      rewardId,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppThanksRedemption.parse({
      id: result.id,
      employee_id: result.employeeId,
      reward_id: result.rewardId,
      point_cost: result.pointCost,
      status: result.status,
      created_at: result.createdAt,
      decided_at: result.decidedAt,
      decider_id: result.deciderId,
    })

    return c.json(responseBody, 201)
  },
)
