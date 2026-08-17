import { ListMyRedemptions } from "@/contexts/thanks/application/thanks-points/list-my-redemptions"
import type { ThanksRedemption } from "@/contexts/thanks/domain/thanks-points/thanks-redemption.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksRedemptionList } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { thanksRedemptions } from "@/contexts/thanks/infrastructure/schema/thanks"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /thanks-redemptions/me — 自分の交換申請の一覧（新しい順・ページング） */
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

  const redemptions = await new ListMyRedemptions(c).run({
    employeeId: session.employeeId,
    limit,
    offset,
  })

  if (redemptions instanceof ApplicationError) {
    throw toHttpException(redemptions)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(thanksRedemptions)
    .where(eq(thanksRedemptions.employeeId, session.employeeId))

  const responseBody = zAppThanksRedemptionList.parse({
    data: redemptions.map(toRedemptionResponse),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

/** 交換申請集約を snake_case のレスポンスへ写す。 */
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
