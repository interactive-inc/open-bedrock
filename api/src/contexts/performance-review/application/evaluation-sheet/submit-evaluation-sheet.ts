import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EvaluationSheet } from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import { EvaluationSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/evaluation-sheet/evaluation-sheet.repository"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  sheetId: number
  actorEmployeeId: EmployeeId
  expectedRevision: number
  note: string | null
  now: string
}

/** 評価シートを承認申請する。 */
export class SubmitEvaluationSheet {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<EvaluationSheet | ApplicationError> {
    const repository = new EvaluationSheetRepository(this.c)
    const existing = await repository.findById(command.sheetId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load evaluation sheet", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("evaluation sheet not found", "evaluation_sheet_not_found")
    }

    if (existing.revision !== command.expectedRevision) {
      return new ConflictError(
        "evaluation sheet was modified by another request",
        "revision_conflict",
      )
    }

    const weightError = await this.validateWeights(command.sheetId)

    if (weightError !== null) {
      return weightError
    }

    const transitioned = existing.transition("pending_approval", command.now)

    if (transitioned === null) {
      return new ConflictError(
        `cannot transition from ${existing.status} to pending_approval`,
        "invalid_status_transition",
      )
    }

    const saved = await repository.submitWithAuditLog(existing, transitioned, {
      actorId: command.actorEmployeeId,
      note: command.note,
      now: command.now,
    })

    if (saved instanceof ConflictError) {
      return saved
    }

    if (saved instanceof Error) {
      return new UnexpectedError("failed to submit evaluation sheet", { cause: saved })
    }

    return saved
  }

  private async validateWeights(sheetId: number): Promise<ApplicationError | null> {
    const total = await new EvaluationSheetRepository(this.c).totalGoalWeight(sheetId)

    if (total instanceof Error) {
      return new UnexpectedError("failed to load evaluation sheet goals", { cause: total })
    }

    if (total === 0) {
      return new ValidationError(
        "cannot submit: no goals are linked to this evaluation sheet",
        "no_goals",
      )
    }

    if (total !== 100) {
      return new ValidationError(
        `cannot submit: total goal weight must be exactly 100% (current: ${total}%)`,
        "weight_not_100",
      )
    }

    return null
  }
}
