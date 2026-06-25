import type { SurveyResponse } from "@/domain/survey/survey-response.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  responseId: number
  respondentId: number
}

/**
 * アンケート回答を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SurveyResponse | ApplicationError> {
    const surveyRepository = new SurveyRepository(this.c)

    const response = await surveyRepository.findResponseById(command.responseId)

    if (response instanceof Error) {
      return new UnexpectedError("failed to find survey response", { cause: response })
    }

    if (response === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (response.respondentId !== command.respondentId) {
      return new ForbiddenError("not the respondent", "not_respondent")
    }

    return response
  }
}
