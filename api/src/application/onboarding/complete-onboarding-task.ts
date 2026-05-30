import { canCompleteTask } from "@/domain/onboarding/can-complete-task"
import type { OnboardingTask } from "@/domain/onboarding/onboarding-task"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  taskId: number
  viewerEmployeeId: number
  viewerRole: string
  completedAt: string
}

export type TaskNotFound = { reason: "task_not_found" }

export type Forbidden = { reason: "forbidden" }

/**
 * タスクを完了し、割り当ての完了状態を再計算する。本人か特権ロールのみ許可。
 */
export class CompleteOnboardingTask {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTask | TaskNotFound | Forbidden | Error> {
    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const assignment = await assignmentRepository.findByTaskId(command.taskId)

    if (assignment instanceof Error) {
      return assignment
    }

    if (assignment === null) {
      return { reason: "task_not_found" }
    }

    const allowed = canCompleteTask({
      taskEmployeeId: assignment.employeeId,
      viewerEmployeeId: command.viewerEmployeeId,
      viewerRole: command.viewerRole,
    })

    if (allowed === false) {
      return { reason: "forbidden" }
    }

    const updated = await assignmentRepository.update(
      assignment.completeTask(command.taskId, command.completedAt),
    )

    if (updated instanceof Error) {
      return updated
    }

    const completed = updated.tasks.find((task) => task.id === command.taskId)

    if (completed === undefined) {
      return { reason: "task_not_found" }
    }

    return completed
  }
}
