import { Goal } from "@/domain/goal/goal"
import type { Context } from "@/env"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  employeeId: number
  period: string
  title: string
  kpi: string | null
  weight: number
}

/**
 * 認証された本人に紐づく目標を新規作成する。
 */
export class CreateGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | Error> {
    const repository = new GoalRepository(this.c)

    const goal = Goal.create({
      employeeId: command.employeeId,
      period: command.period,
      title: command.title,
      kpi: command.kpi,
      weight: command.weight,
    })

    return await repository.create(goal)
  }
}
