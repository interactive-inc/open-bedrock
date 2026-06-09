import { LeaveRequest } from "@/domain/leave/leave-request"
import { toLeaveDays } from "@/domain/leave/to-leave-days"
import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  employeeId: number
  leaveType: "annual" | "special"
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

export type InvalidLeavePeriod = { failure: "invalid_leave_period" }

export type OverlappingLeaveRequest = { failure: "overlapping_leave_request" }

/**
 * 休暇申請を pending で新規作成する。期間から日数を導出する。
 */
export class CreateLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<LeaveRequest | InvalidLeavePeriod | OverlappingLeaveRequest | Error> {
    const repository = new LeaveRequestRepository(this.c)

    const days = toLeaveDays(command.startDate, command.endDate)

    if (days instanceof Error) {
      return { failure: "invalid_leave_period" }
    }

    // 同社員・同期間の未却下申請があれば、全承認時の残数二重減算を防ぐため拒否する。
    const overlapping = await repository.findOverlapping({
      employeeId: command.employeeId,
      startDate: command.startDate,
      endDate: command.endDate,
    })

    if (overlapping instanceof Error) {
      return overlapping
    }

    if (overlapping.length > 0) {
      return { failure: "overlapping_leave_request" }
    }

    const leaveRequest = LeaveRequest.create({
      employeeId: command.employeeId,
      leaveType: command.leaveType,
      startDate: command.startDate,
      endDate: command.endDate,
      days,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    return await repository.create(leaveRequest)
  }
}
