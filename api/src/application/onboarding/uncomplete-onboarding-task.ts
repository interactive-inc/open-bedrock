import type { Session } from "@/domain/company/iam/session"
import { canCompleteTask } from "@/application/onboarding/can-complete-task"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTask } from "@/domain/onboarding/onboarding-task.entity"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  taskId: number
  session: Session
}

/**
 * タスクの完了を取り消し、割り当ての完了状態を再計算する。本人か特権ロールのみ許可。
 */
export class UncompleteOnboardingTask {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTask | ApplicationError> {
    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const assignment = await assignmentRepository.findByTaskId(command.taskId)

    if (assignment instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: assignment })
    }

    if (assignment === null) {
      return new NotFoundError("task not found", "task_not_found")
    }

    const allowed = canCompleteTask({
      taskEmployeeId: assignment.employeeId,
      session: command.session,
    })

    if (allowed === false) {
      return new ForbiddenError("cannot uncomplete task", "forbidden")
    }

    if (assignment.id === null) {
      return new UnexpectedError("assignment has no id")
    }

    const updated = await assignmentRepository.uncompleteTask(command.taskId, assignment.id)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update assignment", { cause: updated })
    }

    // null = task was already pending (guard aborted) — re-fetch to avoid returning the
    // pre-lock snapshot, which may reflect state from before a concurrent write.
    let source = updated
    if (source === null) {
      const current = await assignmentRepository.findByTaskId(command.taskId)
      if (current instanceof Error) {
        return new UnexpectedError("failed to re-fetch assignment after guard abort", {
          cause: current,
        })
      }
      if (current === null) {
        return new NotFoundError("task not found", "task_not_found")
      }
      source = current
    }

    const reverted = source.tasks.find((task) => task.id === command.taskId)

    if (reverted === undefined) {
      return new NotFoundError("task not found", "task_not_found")
    }

    return reverted
  }
}
