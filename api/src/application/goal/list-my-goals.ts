import type { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
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

  async run(command: Command): Promise<ReadonlyArray<Goal> | Error> {
    const repository = new GoalRepository(this.c)

    const opts =
      command.limit !== undefined && command.offset !== undefined
        ? { limit: command.limit, offset: command.offset }
        : undefined

    return await repository.findByEmployeeId(command.employeeId, opts)
  }
}
