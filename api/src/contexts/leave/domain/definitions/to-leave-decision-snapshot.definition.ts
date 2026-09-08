import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"

/** 判断対象の内容と直前の状態を、監査と保存時の照合で共有する。 */
export function toLeaveDecisionSnapshot(request: LeaveRequest) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    days: request.days,
    unit: request.unit,
    hours: request.hours,
    consumedDays: request.consumedDays,
    reason: request.reason,
    status: request.status,
    approverId: request.approverId,
    decidedComment: request.decidedComment,
    createdAt: request.createdAt,
  }
}
