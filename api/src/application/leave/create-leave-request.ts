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

/**
 * 休暇申請を pending で新規作成する。期間から日数を導出する。
 */
export class CreateLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | InvalidLeavePeriod | Error> {
    const repository = new LeaveRequestRepository(this.c)

    const days = toLeaveDays(command.startDate, command.endDate)

    if (days instanceof Error) {
      return { failure: "invalid_leave_period" }
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
