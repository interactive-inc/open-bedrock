import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  responseId: number
  respondentId: number
}

export type Withdrawn = { reason: "withdrawn" }

/**
 * アンケート回答を取り下げる。本人以外と、公開を終えたアンケートからの取り下げを拒否する。
 */
export class WithdrawSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Withdrawn | ApplicationError> {
    const surveyRepository = new SurveyRepository(this.c)

    const current = await surveyRepository.findResponseById(command.responseId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey response", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (current.respondentId !== command.respondentId) {
      return new ForbiddenError("not the respondent", "not_respondent")
    }

    const survey = await surveyRepository.findById(current.surveyId)

    if (survey instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: survey })
    }

    if (survey === null || survey.isOpen() === false) {
      return new ConflictError("survey is not open", "survey_not_open")
    }

    const deleted = await surveyRepository.deleteResponse(command.responseId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete survey response", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (deleted !== true && "reason" in deleted) {
      return new ConflictError("survey is not open", "survey_not_open")
    }

    return { reason: "withdrawn" }
  }
}
