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

export type DeleteFailure = Forbidden | SurveyNotFound | NotDeletable

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

    const responsesDeleted = await surveyRepository.deleteResponsesBySurveyId(command.surveyId)

    if (responsesDeleted instanceof Error) {
      return responsesDeleted
    }

    const deleted = await surveyRepository.delete(command.surveyId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
