import { RequestRedemption } from "@/contexts/company/application/thanks-points/request-redemption"
import { toPositiveInt } from "@/contexts/company/interface/utils/to-positive-int"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksRedemption } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { BadRequestError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** POST /thanks-redemptions — 受領残高から交換を申請する */
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
