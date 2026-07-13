import { canDecideLeave } from "@/lib/leave/can-decide-leave"
import { canViewAllLeaves } from "@/lib/leave/can-view-all-leaves"
import { hasPermission } from "@/lib/auth/has-permission"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"
import type { LeaveRequest } from "@/domain/leave/leave-request.entity"
import type { Context, SessionPayload } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
  session?: SessionPayload
}

/**
 * 休暇申請を1件取得する。申請者本人または承認権限を持つロールのみ閲覧可能。
 */
export class GetLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | ApplicationError> {
    const repository = new LeaveRequestRepository(this.c)

    const leaveRequest = await repository.findById(command.leaveRequestId)

    if (leaveRequest instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: leaveRequest })
    }

    if (leaveRequest === null) {
      return new NotFoundError("leave request not found", "leave_request_not_found")
    }

    const isApplicant = leaveRequest.employeeId === command.employeeId
    if (isApplicant === false) {
      const canViewAll = command.session !== undefined && canViewAllLeaves(command.session)

      if (canViewAll) {
        return leaveRequest
      }

      const canDecide = command.session !== undefined && canDecideLeave(command.session)

      if (canDecide === false || command.session === undefined) {
        return new ForbiddenError("not the applicant", "not_applicant")
      }

      if (hasPermission(command.session, "org:manage") === false) {
        const organizationAuthority = await resolveOrganizationAuthority(
          this.c,
          command.employeeId,
          leaveRequest.employeeId,
        )

        if (organizationAuthority instanceof Error) {
          return new UnexpectedError("failed to resolve organization authority", {
            cause: organizationAuthority,
          })
        }

        if (
          organizationAuthority.managementChain === false &&
          organizationAuthority.departmentManager === false
        ) {
          return new ForbiddenError(
            "cannot view leave request outside organization scope",
            "forbidden",
          )
        }
      }
    }

    return leaveRequest
  }
}
