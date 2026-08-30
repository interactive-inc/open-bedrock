import type { LeaveType } from "@/contexts/leave/domain/definitions/leave-request.definition"

const BALANCE_TRACKED_LEAVE_TYPES: ReadonlySet<LeaveType> = new Set([
  "annual",
  "special",
  "summer",
  "child_nursing_care",
  "caregiving_leave",
])

/** 残高管理（年度ごとの付与・消化）の対象となる休暇種別かどうか。 */
export function hasLeaveBalanceTracking(leaveType: LeaveType): boolean {
  return BALANCE_TRACKED_LEAVE_TYPES.has(leaveType)
}
