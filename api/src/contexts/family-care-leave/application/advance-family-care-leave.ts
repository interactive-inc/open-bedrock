import type { Session } from "@/contexts/company/domain/iam/session"
import { FamilyCareLeave } from "@/contexts/family-care-leave/domain/family-care-leave.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/family-care-leave-repository"

export type Action = "approve" | "cancel"

export type Command = {
  session: Session
  familyCareLeaveId: string
  action: Action
}

/**
 * 人事が産休・育休・介護休業の申出の状態を代理で進める。requested のみ approved/cancelled へ遷移でき、
 * それ以外の現在状態からの遷移は 409 とする。
 */
export class AdvanceFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<FamilyCareLeave | ApplicationError> {
    if (command.session.hasPermission("family_care_leave:manage") === false) {
      return new ForbiddenError("cannot manage family care leaves", "forbidden")
    }

    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const current = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find family care leave", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("family care leave not found", "family_care_leave_not_found")
    }

    const next = command.action === "approve" ? current.withApproved() : current.withCancelled()

    if (next instanceof FamilyCareLeave === false) {
      return new ConflictError("family care leave is not in a transitionable state", next.reason)
    }

    const updated = await familyCareLeaveRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update family care leave status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError(
        "family care leave is not in a transitionable state",
        "invalid_transition",
      )
    }

    return updated
  }
}
