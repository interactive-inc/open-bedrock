import { Goal } from "@/domain/goal/goal.entity"
import type { GoalOwnerType } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"
import { evaluationSheets } from "@/schema"
import { eq } from "drizzle-orm"

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
    // evaluation_sheet_id が指定された場合、シートの存在と所有者を検証する
    if (command.evaluationSheetId !== undefined && command.evaluationSheetId !== null) {
      const sheetRows = await this.c.var.database
        .select({ id: evaluationSheets.id, employeeId: evaluationSheets.employeeId })
        .from(evaluationSheets)
        .where(eq(evaluationSheets.id, command.evaluationSheetId))
        .limit(1)

      const sheet = sheetRows.at(0)

      if (sheet === undefined) {
        return new ValidationError("evaluation sheet not found", "evaluation_sheet_not_found")
      }

      if (sheet.employeeId !== command.employeeId) {
        return new ValidationError(
          "evaluation sheet does not belong to this employee",
          "evaluation_sheet_owner_mismatch",
        )
      }
    }

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
