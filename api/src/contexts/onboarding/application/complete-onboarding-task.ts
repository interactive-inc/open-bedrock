import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { canCompleteTask } from "@/contexts/onboarding/domain/policies/task-completion.policy"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTask } from "@/contexts/onboarding/domain/entities/onboarding-task.entity"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"

export type Command = {
  taskId: number
  session: CompanySessionValue
  completedAt: string
}

/**
 * タスクを完了し、割り当ての完了状態を再計算する。本人か特権ロールのみ許可。
 */
export class CompleteOnboardingTask {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
      return new ForbiddenError("cannot complete task", "forbidden")
    }

    if (assignment.status === "superseded") {
      return new ConflictError("assignment is superseded", "assignment_superseded")
    }

    if (assignment.id === null) {
      return new UnexpectedError("assignment has no id")
    }

    const updated = await assignmentRepository.completeTask(
      command.taskId,
      assignment.id,
      command.completedAt,
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update assignment", { cause: updated })
    }

    // null = task was already done (guard aborted) — re-fetch to avoid returning the
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
      // 読取り後に人事訂正で置き換えられた割当は、タスクを変更せず競合として返す。
      if (current.status === "superseded") {
        return new ConflictError("assignment is superseded", "assignment_superseded")
      }
      source = current
    }

    const completed = source.tasks.find((task) => task.id === command.taskId)

    if (completed === undefined) {
      return new NotFoundError("task not found", "task_not_found")
    }

    return completed
  }
}
