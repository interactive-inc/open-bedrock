import type { SurveySubmissionView } from "@/contexts/survey/domain/values/survey-submission-view.definition"
import { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/contexts/survey/infrastructure/survey.repository"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  surveyId: number
  respondentId: number
  answersJson: unknown
  submittedAt: string
}

/**
 * アンケート回答を提出する。未公開・重複提出は判別可能な失敗で返す。
 */
export class SubmitSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SurveySubmissionView | ApplicationError> {
    const surveyRepository = new SurveyRepository(this.c)

    const survey = await surveyRepository.findById(command.surveyId)

    if (survey instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: survey })
    }

    if (survey === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    if (survey.status !== "open") {
      return new ConflictError("survey is not open", "survey_not_open")
    }

    const existing = await surveyRepository.findResponseBySurveyIdAndRespondentId(
      command.surveyId,
      command.respondentId,
    )

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find survey response", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("survey response already submitted", "already_submitted")
    }

    const surveyResponse = SurveyResponse.create({
      surveyId: command.surveyId,
      respondentId: command.respondentId,
      answersJson: command.answersJson,
      submittedAt: command.submittedAt,
    })

    const created = await surveyRepository.createResponse(surveyResponse)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create survey response", { cause: created })
    }

    if ("reason" in created) {
      if (created.reason === "survey_not_open") {
        return new ConflictError("survey is not open", "survey_not_open")
      }

      return new ConflictError("survey response already submitted", "already_submitted")
    }

    if (created.id === null) {
      return new UnexpectedError("failed to submit survey response")
    }

    return {
      id: created.id,
      surveyId: created.surveyId,
      respondentId: created.respondentId,
      answersJson: created.answersJson,
      submittedAt: created.submittedAt,
    }
  }
}
