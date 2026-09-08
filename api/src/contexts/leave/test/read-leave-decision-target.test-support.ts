import { leaveDecisionTargetSchema } from "@/contexts/leave/domain/definitions/leave-decision-target.definition"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { z } from "zod"

/** 実際の詳細レスポンスから確認対象を取得する。 */
export async function readLeaveDecisionTarget(
  db: D1Database,
  jwtSecret: string,
  now: string,
  id: number,
  token: string,
) {
  const response = await requestWithContext({
    db,
    jwtSecret,
    now,
    path: `/leave/leave-requests/${id}`,
    token,
  })
  if (response.status !== 200) throw new Error(`review failed: ${response.status}`)
  return z.object({ decision_target: leaveDecisionTargetSchema }).parse(await response.json())
    .decision_target
}
