import type { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { canViewOthers } from "@/lib/goal/goal-access"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  viewerEmployeeId: number
  viewerRole: string
}

/**
 * 目標を1件取得する。本人と特権ロール以外の閲覧を拒否する。
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

    if (isOwner === false && canViewOthers(command.viewerRole) === false) {
      return new ForbiddenError("cannot view this goal", "not_viewable")
    }

    return goal
  }
}
