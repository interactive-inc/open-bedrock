import { canManageSurveys } from "@/lib/survey/can-manage-surveys"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  viewerRole: string
  surveyId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者がアンケートを削除する。
 * 本体をガード付きで削除してから関連する回答（survey_responses）を削除する。
 */
export class DeleteSurvey {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    if (canManageSurveys(command.viewerRole) === false) {
      return new ForbiddenError("cannot manage surveys", "forbidden")
    }

    const surveyRepository = new SurveyRepository(this.c)

    const current = await surveyRepository.findById(command.surveyId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    if (current.isOpen()) {
      return new ConflictError("open survey cannot be deleted", "not_deletable")
    }

    const db = this.c.env.DB

    try {
      await db.batch([
        db.prepare("DELETE FROM surveys WHERE id = ?1 AND status != 'open'").bind(command.surveyId),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare("DELETE FROM survey_responses WHERE survey_id = ?1").bind(command.surveyId),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        const survey = await surveyRepository.findById(command.surveyId)

        if (survey instanceof Error) {
          return new UnexpectedError("failed to find survey", { cause: survey })
        }

        if (survey === null) {
          return new ConflictError("survey was modified concurrently", "not_found")
        }

        if (survey.isOpen()) {
          return new ConflictError("open survey cannot be deleted", "not_deletable")
        }

        return new ConflictError("survey was modified concurrently", "not_found")
      }

      return error instanceof Error
        ? new UnexpectedError("failed to delete survey", { cause: error })
        : new UnexpectedError("failed to delete survey")
    }

    return { reason: "deleted" }
  }
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
