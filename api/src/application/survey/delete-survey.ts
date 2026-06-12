import { canManageSurveys } from "@/domain/survey/can-manage-surveys"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  viewerRole: string
  surveyId: number
}

export type Forbidden = { reason: "forbidden" }

export type SurveyNotFound = { reason: "survey_not_found" }

export type Deleted = { reason: "deleted" }

export type NotDeletable = { reason: "not_deletable" }

export type NotFound = { reason: "not_found" }

export type DeleteFailure = Forbidden | SurveyNotFound | NotDeletable | NotFound

/**
 * 管理権限を持つ者がアンケートを削除する。
 * 本体をガード付きで削除してから関連する回答（survey_responses）を削除する。
 */
export class DeleteSurvey {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | DeleteFailure | Error> {
    if (canManageSurveys(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const surveyRepository = new SurveyRepository(this.c)

    const current = await surveyRepository.findById(command.surveyId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "survey_not_found" }
    }

    if (current.isOpen()) {
      return { reason: "not_deletable" }
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
          return survey
        }

        if (survey === null) {
          return { reason: "not_found" }
        }

        if (survey.isOpen()) {
          return { reason: "not_deletable" }
        }

        return { reason: "not_found" }
      }

      return error instanceof Error ? error : new Error("failed to delete survey")
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
