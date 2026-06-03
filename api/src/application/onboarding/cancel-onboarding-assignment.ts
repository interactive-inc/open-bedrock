import { canViewEmployeeOnboarding } from "@/domain/onboarding/can-view-employee-onboarding"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  viewerRole: string
}

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type Cancelled = { reason: "cancelled" }

/**
 * 割り当てを配下タスクごと取り消す。特権ロールのみ許可する。
 */
export class CancelOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | AssignmentNotFound | Forbidden | Error> {
    if (canViewEmployeeOnboarding({ viewerRole: command.viewerRole }) === false) {
      return { reason: "forbidden" }
    }

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(command.assignmentId)

    if (current instanceof Error) {
      return { reason: "assignment_not_found" }
    }

    const deleted = await assignmentRepository.delete(command.assignmentId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
