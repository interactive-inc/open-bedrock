import type { Session } from "@/contexts/company/domain/iam/session"
import type { Goal } from "@/contexts/performance-review/domain/goal/goal.entity"
import type { Context } from "@/env"
import { canReadGoalOf } from "@/contexts/performance-review/domain/goal/can-read-goal-of"
import { resolveEmployeeRelation } from "@/contexts/company/application/organization/resolve-employee-relation"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  viewerEmployeeId: number
  session: Session
}

/**
 * 目標を1件取得する。本人と goal:read:all 権限以外の閲覧を拒否する。
 */
export class GetGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | ApplicationError> {
    const repository = new GoalRepository(this.c)

    const goal = await repository.findById(command.goalId)

    if (goal instanceof Error) {
      return new UnexpectedError("failed to find goal", { cause: goal })
    }

    if (goal === null) {
      return new NotFoundError("goal not found", "goal_not_found")
    }

    const isOwner = goal.employeeId === command.viewerEmployeeId

    if (isOwner === false) {
      const relation = await resolveEmployeeRelation({
        c: this.c,
        viewerEmployeeId: command.viewerEmployeeId,
        targetEmployeeId: goal.employeeId,
      })

      if (relation instanceof Error) {
        return new UnexpectedError("failed to resolve employee relation", { cause: relation })
      }

      if (canReadGoalOf(command.session, relation) === false) {
        return new ForbiddenError("cannot view this goal", "not_viewable")
      }
    }

    return goal
  }
}
