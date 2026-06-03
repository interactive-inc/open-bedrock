import type { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
}

export type LeaveRequestNotFound = { reason: "leave_request_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * 休暇申請を1件取得する。申請者本人以外の閲覧を拒否する。
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

    if (leaveRequest.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    return leaveRequest
  }
}
