import type { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  responseId: number
  respondentId: number
  answersJson: unknown
  submittedAt: string
}

/**
 * アンケート回答の内容を差し替える。本人以外と、公開を終えたアンケートへの変更を拒否する。
 */
export class UpdateSurveyResponse {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<SurveyResponse | ApplicationError> {
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

    const updated = current.withAnswers({
      answersJson: command.answersJson,
      submittedAt: command.submittedAt,
    })

    const result = await surveyRepository.updateResponse(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update survey response", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if ("reason" in result) {
      return new ConflictError("survey is not open", "survey_not_open")
    }

    return result
  }
}
