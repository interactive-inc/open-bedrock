import type { LeaveRequest } from "@/domain/leave/leave-request"
import { toLeaveDays } from "@/domain/leave/to-leave-days"
import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
  leaveType: "annual" | "special"
  startDate: string
  endDate: string
  reason: string | null
}

export type LeaveRequestNotFound = { reason: "leave_request_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type InvalidLeavePeriod = { reason: "invalid_leave_period" }

export type OverlappingLeaveRequest = { reason: "overlapping_leave_request" }

type Failure =
  | LeaveRequestNotFound
  | NotApplicant
  | NotModifiable
  | InvalidLeavePeriod
  | OverlappingLeaveRequest

/**
 * 休暇申請の内容を変更する。本人以外と、決定済み申請の変更を拒否する。
 */
export class UpdateLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | Failure | Error> {
    const repository = new LeaveRequestRepository(this.c)

    const current = await repository.findById(command.leaveRequestId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "leave_request_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    if (current.isModifiable === false) {
      return { reason: "not_modifiable" }
    }

    const days = toLeaveDays(command.startDate, command.endDate)

    if (days instanceof Error) {
      return { reason: "invalid_leave_period" }
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
      return overlapping
    }

    if (overlapping.length > 0) {
      return { reason: "overlapping_leave_request" }
    }

    const revised = current.withRevised({
      leaveType: command.leaveType,
      startDate: command.startDate,
      endDate: command.endDate,
      days,
      reason: command.reason,
    })

    const updated = await repository.revise(revised)

    if (updated === "already_decided") {
      return { reason: "not_modifiable" }
    }

    if (updated === "overlapping") {
      return { reason: "overlapping_leave_request" }
    }

    return updated
  }
}
