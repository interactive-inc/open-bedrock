import { LeaveBalanceSufficiencyRepository } from "@/contexts/leave/infrastructure/leave-balance-sufficiency.repository"
import { computeConsumedDays } from "@/contexts/leave/domain/policies/compute-consumed-days.policy"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { validateLeaveUnit } from "@/contexts/leave/domain/policies/validate-leave-unit.policy"
import type { Context } from "@/env"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/leave-request.repository"
import type { LeaveType, LeaveUnit } from "@/lib/schemas"

export type Command = {
  employeeId: number
  leaveType: LeaveType
  startDate: string
  endDate: string
  unit: LeaveUnit
  hours: number | null
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

    const unitError = validateLeaveUnit({
      unit: command.unit,
      hours: command.hours,
      startDate: command.startDate,
      endDate: command.endDate,
    })

    if (unitError !== null) {
      return new ValidationError("invalid leave unit", "invalid_leave_unit", { cause: unitError })
    }

    const consumedDays = computeConsumedDays({ unit: command.unit, hours: command.hours, days })

    const balanceError = await new LeaveBalanceSufficiencyRepository(this.c).check({
      employeeId: command.employeeId,
      leaveType: command.leaveType,
      startDate: command.startDate,
      consumedDays,
    })

    if (balanceError !== null) {
      return balanceError
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
      unit: command.unit,
      hours: command.hours,
      consumedDays,
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
