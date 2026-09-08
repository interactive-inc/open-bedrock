import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveDecisionTargetValue } from "@/contexts/leave/domain/values/leave-decision-target.value"

/** テストで確認した時点の内容を保持する。送信時には再計算しない。 */
export async function reviewLeaveRequest(request: LeaveRequest) {
  const target = await LeaveDecisionTargetValue.create(request)
  if (target instanceof Error) throw target
  if (target === null) throw new Error("pending persisted request required")
  return target.toJSON()
}
