import type { Session } from "@/lib/auth/session"
import { FamilyCareLeave } from "@/contexts/family-care-leave/domain/entities/family-care-leave.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/repositories/family-care-leave.repository"

export type Command = {
  session: Session
  familyCareLeaveId: string
}

/** 産休・育休・介護休業の申出を取り消す。 */
export class CancelFamilyCareLeave {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<FamilyCareLeave | ApplicationError> {
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

    const next = current.withCancelled()

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
