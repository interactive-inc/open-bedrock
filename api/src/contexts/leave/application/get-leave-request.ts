import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { resolveOrganizationAuthority } from "@/contexts/company-compatibility/application/organization/resolve-organization-authority"
import type { LeaveRequest } from "@/contexts/leave/domain/leave-request.entity"
import type { Context } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
  session?: Session
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
      const canViewAll =
        command.session !== undefined && command.session.hasPermission("leave:read:all")

      if (canViewAll) {
        return leaveRequest
      }

      const canDecide =
        command.session !== undefined && command.session.hasPermission("leave:approve")

      if (canDecide === false || command.session === undefined) {
        return new ForbiddenError("not the applicant", "not_applicant")
      }

      if (command.session.hasPermission("org:manage") === false) {
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
