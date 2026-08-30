import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { LeaveBalanceSufficiencyAdapter } from "@/contexts/leave/infrastructure/adapters/leave-balance-sufficiency.adapter"
import { computeConsumedDays } from "@/contexts/leave/domain/policies/compute-consumed-days.policy"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { validateLeaveUnit } from "@/contexts/leave/domain/policies/validate-leave-unit.policy"
import type { Context } from "@/env"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import type {
  LeaveType,
  LeaveUnit,
} from "@/contexts/leave/domain/definitions/leave-request.definition"

export type Command = {
  leaveRequestId: number
  employeeId: EmployeeId
  leaveType: LeaveType
  startDate: string
  endDate: string
  unit: LeaveUnit
  hours: number | null
  reason: string | null
}

/**
 * 休暇申請の内容を変更する。本人以外と、決定済み申請の変更を拒否する。
 */
export class UpdateLeaveRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<LeaveRequest | ApplicationError> {
    const repository = new LeaveRequestRepository(this.c)

    const current = await repository.findById(command.leaveRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("leave request not found", "leave_request_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.isModifiable === false) {
      return new ConflictError("the leave request is already decided", "not_modifiable")
    }

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

    const balanceError = await new LeaveBalanceSufficiencyAdapter(this.c).check({
      employeeId: command.employeeId,
      leaveType: command.leaveType,
      startDate: command.startDate,
      consumedDays,
    })

    if (balanceError !== null) {
      return balanceError
    }

    // 自分自身を除外して、同社員・同期間の未却下申請と重ならないか確認する。
    // 除外しないと更新のたびに自己ヒットして必ず重複扱いになる。
    const overlapping = await repository.findOverlapping({
      employeeId: command.employeeId,
      startDate: command.startDate,
      endDate: command.endDate,
      excludeId: command.leaveRequestId,
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

    const revised = current.withRevised({
      leaveType: command.leaveType,
      startDate: command.startDate,
      endDate: command.endDate,
      days,
      unit: command.unit,
      hours: command.hours,
      consumedDays,
      reason: command.reason,
    })

    const updated = await repository.revise(revised)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update leave request", { cause: updated })
    }

    if (updated === "already_decided") {
      return new ConflictError("the leave request is already decided", "not_modifiable")
    }

    if (updated === "overlapping") {
      return new ConflictError(
        "an overlapping leave request already exists",
        "overlapping_leave_request",
      )
    }

    return updated
  }
}
