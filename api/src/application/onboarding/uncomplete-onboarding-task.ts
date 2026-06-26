import { canCompleteTask } from "@/lib/onboarding/can-complete-task"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTask } from "@/domain/onboarding/onboarding-task.entity"
import type { Context, SessionPayload } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  taskId: number
  session: SessionPayload
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

    const updated = await assignmentRepository.update(assignment.uncompleteTask(command.taskId))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update assignment", { cause: updated })
    }

    const reverted = updated.tasks.find((task) => task.id === command.taskId)

    if (reverted === undefined) {
      return new NotFoundError("task not found", "task_not_found")
    }

    return reverted
  }
}
