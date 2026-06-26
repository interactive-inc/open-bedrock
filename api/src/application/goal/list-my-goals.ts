import type { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  employeeId: number
  limit?: number
  offset?: number
}

/**
 * 社員本人の目標を一覧する。
 */
export class ListMyGoals {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<Goal> | ApplicationError> {
    const repository = new GoalRepository(this.c)

    const opts =
      command.limit !== undefined && command.offset !== undefined
        ? { limit: command.limit, offset: command.offset }
        : undefined

    const goals = await repository.findByEmployeeId(command.employeeId, opts)

    if (goals instanceof Error) {
      return new UnexpectedError("failed to load goals", { cause: goals })
    }

    return goals
  }
}
