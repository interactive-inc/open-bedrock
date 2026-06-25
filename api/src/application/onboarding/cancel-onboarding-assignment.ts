import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  viewerRole: string
}

export type Cancelled = { reason: "cancelled" }

/**
 * 割り当てを配下タスクごと取り消す。特権ロールのみ許可する。
 */
export class CancelOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    if (canManageOnboarding(command.viewerRole) === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(command.assignmentId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    if (current.status === "completed") {
      return new ConflictError("assignment is not modifiable", "not_modifiable")
    }

    const deleted = await assignmentRepository.delete(command.assignmentId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete assignment", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("assignment is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
