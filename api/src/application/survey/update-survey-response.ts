import type { SurveyResponse } from "@/domain/survey/survey-response"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  responseId: number
  respondentId: number
  answersJson: unknown
  submittedAt: string
}

export type ResponseNotFound = { reason: "response_not_found" }

export type NotRespondent = { reason: "not_respondent" }

export type SurveyNotOpen = { reason: "survey_not_open" }

export type UpdateSurveyResponseFailure = ResponseNotFound | NotRespondent | SurveyNotOpen

/**
 * アンケート回答の内容を差し替える。本人以外と、公開を終えたアンケートへの変更を拒否する。
 */
export class UpdateSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SurveyResponse | UpdateSurveyResponseFailure | Error> {
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

    const updated = current.withAnswers({
      answersJson: command.answersJson,
      submittedAt: command.submittedAt,
    })

    const result = await surveyRepository.updateResponse(updated)

    if (result === null) {
      return { reason: "response_not_found" }
    }

    if (!(result instanceof Error) && "reason" in result) {
      return { reason: "survey_not_open" }
    }

    return result
  }
}
