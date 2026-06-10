import { canDecideLeave } from "@/domain/leave/can-decide-leave"
import type { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
  viewerRole?: string
}

export type LeaveRequestNotFound = { reason: "leave_request_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * 休暇申請を1件取得する。申請者本人または承認権限を持つロールのみ閲覧可能。
 */
export class GetLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | LeaveRequestNotFound | NotApplicant | Error> {
    const repository = new LeaveRequestRepository(this.c)

    const leaveRequest = await repository.findById(command.leaveRequestId)

    if (leaveRequest instanceof Error) {
      return leaveRequest
    }

    if (leaveRequest === null) {
      return { reason: "leave_request_not_found" }
    }

    const isApplicant = leaveRequest.employeeId === command.employeeId
    const canDecide = command.viewerRole !== undefined && canDecideLeave(command.viewerRole)

    if (isApplicant === false && canDecide === false) {
      return { reason: "not_applicant" }
    }

    return leaveRequest
  }
}
