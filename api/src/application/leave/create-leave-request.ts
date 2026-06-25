import { LeaveRequest } from "@/domain/leave/leave-request.entity"
import type { Context } from "@/env"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"
import type { LeaveType } from "@/lib/schemas"

export type Command = {
  employeeId: number
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

/**
 * 休暇申請を pending で新規作成する。期間から日数を導出する。
 */
export class CreateLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | ApplicationError> {
    const repository = new LeaveRequestRepository(this.c)

    const days = LeaveRequest.daysBetween(command.startDate, command.endDate)

    if (days instanceof Error) {
      return new ValidationError("invalid leave period", "invalid_leave_period", { cause: days })
    }

    // 同社員・同期間の未却下申請があれば、全承認時の残数二重減算を防ぐため拒否する。
    const overlapping = await repository.findOverlapping({
      employeeId: command.employeeId,
      startDate: command.startDate,
      endDate: command.endDate,
    })

    if (overlapping instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: overlapping })
    }

    if (overlapping.length > 0) {
      return new ConflictError(
        "an overlapping leave request already exists",
        "overlapping_leave_request",
      )
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

    const created = await repository.create(leaveRequest)

    // 条件付き INSERT が 0 行だった場合は並行リクエストによる重複
    if (created === null) {
      return new ConflictError(
        "an overlapping leave request already exists",
        "overlapping_leave_request",
      )
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create leave request", { cause: created })
    }

    return created
  }
}
