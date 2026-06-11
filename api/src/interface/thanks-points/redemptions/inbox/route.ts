import { ListPendingRedemptions } from "@/application/thanks-points/list-pending-redemptions"
import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import { canDecideRedemption } from "@/domain/thanks-points/can-decide-redemption"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { thanksRedemptions } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /thanks/redemptions/inbox — 承認待ちの交換申請一覧（承認権限が必要・ページング）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideRedemption(session.role) === false) {
    throw new ForbiddenError()
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

  const redemptions = await new ListPendingRedemptions(c).run({ limit, offset })

  if (redemptions instanceof Error) {
    throw new InternalError("failed to load pending redemptions")
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(thanksRedemptions)
    .where(eq(thanksRedemptions.status, "pending"))

  const responseBody = redemptions.map(toRedemptionResponse)

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})

// 交換申請集約を snake_case のレスポンスへ写す。
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
