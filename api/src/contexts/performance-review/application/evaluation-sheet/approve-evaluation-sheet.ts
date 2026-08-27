import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EvaluationSheet } from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import { EvaluationSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/evaluation-sheet/evaluation-sheet.repository"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  sheetId: number
  actorEmployeeId: EmployeeId
  expectedRevision: number
  note: string | null
  now: string
}

/** 評価シートを承認する。 */
export class ApproveEvaluationSheet {
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

    const transitioned = existing.transition("approved", command.now)

    if (transitioned === null) {
      return new ConflictError(
        `cannot transition from ${existing.status} to approved`,
        "invalid_status_transition",
      )
    }

    const saved = await repository.updateWithAuditLog(transitioned, {
      actorId: command.actorEmployeeId,
      action: "status_change",
      fromValue: existing.status,
      toValue: "approved",
      note: command.note,
      now: command.now,
    })

    if (saved instanceof Error) {
      if (saved instanceof ConflictError) {
        return saved
      }

      return new UnexpectedError("failed to update evaluation sheet", { cause: saved })
    }

    return saved
  }
}
