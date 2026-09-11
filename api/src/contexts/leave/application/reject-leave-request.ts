import type { LeaveDecisionTarget } from "@/contexts/leave/domain/definitions/leave-decision-target.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import type { Context as HonoContext } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { LeaveDecisionRepository } from "@/contexts/leave/infrastructure/repositories/leave-decision.repository"
import { PrepareLeaveDecisionAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision.adapter"

export type Command = {
  session: CompanySessionValue
  tokenVersion: number
  decisionTarget: LeaveDecisionTarget
  leaveRequestId: number
  approverId: EmployeeId
  comment: string | null
  createdAt: string
}

type Context = Readonly<{
  context: HonoContext
}>

/** 休暇申請を却下する。 */
export class RejectLeaveRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<LeaveRequest | ApplicationError> {
    if (
      !command.session.hasPermission("leave:approve") ||
      command.session.employeeId !== command.approverId
    )
      return new ForbiddenError("cannot decide leave requests", "forbidden")

    const existing = await new LeaveRequestRepository(this.c.context).findById(
      command.leaveRequestId,
    )
    if (existing instanceof Error)
      return new UnexpectedError("failed to find leave request", { cause: existing })
    if (existing === null)
      return new NotFoundError("leave request not found", "leave_request_not_found")

    const prepared = await new PrepareLeaveDecisionAdapter(this.c.context).prepare({
      session: command.session,
      tokenVersion: command.tokenVersion,
      decisionTarget: command.decisionTarget,
      existing,
      approverId: command.approverId,
      status: "rejected",
      comment: command.comment,
    })
    if (prepared instanceof Error) return prepared
    const decided = await new LeaveDecisionRepository(this.c.context).commit(prepared)
    if (decided instanceof Error) return decided

    return decided
  }
}
