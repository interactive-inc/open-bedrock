import { canCompleteTask } from "@/lib/onboarding/can-complete-task"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTask } from "@/domain/onboarding/onboarding-task.entity"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  taskId: number
  viewerEmployeeId: number
  viewerRole: string
  completedAt: string
}

/**
 * タスクを完了し、割り当ての完了状態を再計算する。本人か特権ロールのみ許可。
 */
export class CompleteOnboardingTask {
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
      viewerEmployeeId: command.viewerEmployeeId,
      viewerRole: command.viewerRole,
    })

    if (allowed === false) {
      return new ForbiddenError("cannot complete task", "forbidden")
    }

    const updated = await assignmentRepository.update(
      assignment.completeTask(command.taskId, command.completedAt),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update assignment", { cause: updated })
    }

    const completed = updated.tasks.find((task) => task.id === command.taskId)

    if (completed === undefined) {
      return new NotFoundError("task not found", "task_not_found")
    }

    return completed
  }
}
