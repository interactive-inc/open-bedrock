import { canManageOnboarding } from "@/domain/onboarding/can-manage-onboarding"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  viewerRole: string
}

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 割り当てを配下タスクごと取り消す。特権ロールのみ許可する。
 */
export class CancelOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | AssignmentNotFound | Forbidden | NotModifiable | Error> {
    if (canManageOnboarding(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(command.assignmentId)

    if (current === null) {
      return { reason: "assignment_not_found" }
    }

    if (current instanceof Error) {
      return current
    }

    if (current.status === "completed") {
      return { reason: "not_modifiable" }
    }

    const deleted = await assignmentRepository.delete(command.assignmentId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
