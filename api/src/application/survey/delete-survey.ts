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
 * 関連する回答（survey_responses）を先に削除してから本体を削除する。
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
      const results = await db.batch([
        db.prepare("DELETE FROM survey_responses WHERE survey_id = ?1").bind(command.surveyId),
        db
          .prepare("DELETE FROM surveys WHERE id = ?1 AND status != 'open' RETURNING id")
          .bind(command.surveyId),
      ])

      const surveyResult = results[1]

      if (!surveyResult.results?.length) {
        return { reason: "not_found" }
      }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete survey")
    }

    return { reason: "deleted" }
  }
}
