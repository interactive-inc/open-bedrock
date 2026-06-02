import type { SurveyResponse } from "@/domain/survey/survey-response"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  responseId: number
  respondentId: number
}

export type ResponseNotFound = { reason: "response_not_found" }

export type NotRespondent = { reason: "not_respondent" }

/**
 * アンケート回答を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SurveyResponse | ResponseNotFound | NotRespondent | Error> {
    const surveyRepository = new SurveyRepository(this.c)

    const response = await surveyRepository.findResponseById(command.responseId)

    if (response instanceof Error) {
      return response
    }

    if (response === null) {
      return { reason: "response_not_found" }
    }

    if (response.respondentId !== command.respondentId) {
      return { reason: "not_respondent" }
    }

    return response
  }
}
