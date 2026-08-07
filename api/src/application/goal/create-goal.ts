import { Goal } from "@/domain/goal/goal.entity"
import type { GoalOwnerType } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  employeeId: number
  period: string
  title: string
  kpi: string | null
  weight: number
  ownerType?: GoalOwnerType
  parentGoalId?: number | null
  departmentCode?: string | null
  evaluationSheetId?: number | null
}

/**
 * 認証された本人に紐づく目標を新規作成する。
 */
export class CreateGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | ApplicationError> {
    const repository = new GoalRepository(this.c)

    const goal = Goal.create({
      employeeId: command.employeeId,
      period: command.period,
      title: command.title,
      kpi: command.kpi,
      weight: command.weight,
      ownerType: command.ownerType,
      parentGoalId: command.parentGoalId,
      departmentCode: command.departmentCode,
      evaluationSheetId: command.evaluationSheetId,
    })

    const created = await repository.create(goal)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create goal", { cause: created })
    }

    return created
  }
}
