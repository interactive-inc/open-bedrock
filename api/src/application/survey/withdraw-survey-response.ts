import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  responseId: number
  respondentId: number
}

export type ResponseNotFound = { reason: "response_not_found" }

export type NotRespondent = { reason: "not_respondent" }

export type SurveyNotOpen = { reason: "survey_not_open" }

export type Withdrawn = { reason: "withdrawn" }

export type WithdrawSurveyResponseFailure = ResponseNotFound | NotRespondent | SurveyNotOpen

/**
 * アンケート回答を取り下げる。本人以外と、公開を終えたアンケートからの取り下げを拒否する。
 */
export class WithdrawSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Withdrawn | WithdrawSurveyResponseFailure | Error> {
    const surveyRepository = new SurveyRepository(this.c)

    const current = await surveyRepository.findResponseById(command.responseId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "response_not_found" }
    }

    if (current.respondentId !== command.respondentId) {
      return { reason: "not_respondent" }
    }

    const survey = await surveyRepository.findById(current.surveyId)

    if (survey instanceof Error) {
      return survey
    }

    if (survey === null || survey.isOpen() === false) {
      return { reason: "survey_not_open" }
    }

    const deleted = await surveyRepository.deleteResponse(command.responseId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "response_not_found" }
    }

    return { reason: "withdrawn" }
  }
}
