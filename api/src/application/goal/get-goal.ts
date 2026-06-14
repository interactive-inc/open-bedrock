import type { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { canViewOthers } from "@/lib/goal/goal-access"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  viewerEmployeeId: number
  viewerRole: string
}

export type GoalNotFound = { reason: "goal_not_found" }

export type NotViewable = { reason: "not_viewable" }

/**
 * 目標を1件取得する。本人と特権ロール以外の閲覧を拒否する。
 */
export class GetGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | GoalNotFound | NotViewable | Error> {
    const repository = new GoalRepository(this.c)

    const goal = await repository.findById(command.goalId)

    if (goal instanceof Error) {
      return goal
    }

    if (goal === null) {
      return { reason: "goal_not_found" }
    }

    const isOwner = goal.employeeId === command.viewerEmployeeId

    if (isOwner === false && canViewOthers(command.viewerRole) === false) {
      return { reason: "not_viewable" }
    }

    return goal
  }
}
