import type { SurveySubmissionView } from "@/application/survey/survey-submission-view"
import { SurveyResponse } from "@/domain/survey/survey-response"
import type { Context } from "@/env"
import {
  type AlreadySubmittedError,
  SurveyRepository,
} from "@/infrastructure/survey/survey-repository"

export type Command = {
  surveyId: number
  respondentId: number
  answersJson: unknown
  submittedAt: string
}

export type SurveyNotFound = { reason: "survey_not_found" }

export type SurveyNotOpen = { reason: "survey_not_open" }

export type AlreadySubmitted = { reason: "already_submitted" }

export type SubmitSurveyResponseFailure = SurveyNotFound | SurveyNotOpen | AlreadySubmitted

/**
 * アンケート回答を提出する。未公開・重複提出は判別可能な失敗で返す。
 */
export class SubmitSurveyResponse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SurveySubmissionView | SubmitSurveyResponseFailure | Error> {
    const surveyRepository = new SurveyRepository(this.c)

    const survey = await surveyRepository.findById(command.surveyId)

    if (survey instanceof Error) {
      return survey
    }

    if (survey === null) {
      return { reason: "survey_not_found" }
    }

    if (survey.status !== "open") {
      return { reason: "survey_not_open" }
    }

    const existing = await surveyRepository.findResponseBySurveyIdAndRespondentId(
      command.surveyId,
      command.respondentId,
    )

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "already_submitted" }
    }

    const surveyResponse = SurveyResponse.create({
      surveyId: command.surveyId,
      respondentId: command.respondentId,
      answersJson: command.answersJson,
      submittedAt: command.submittedAt,
    })

    const created = await surveyRepository.createResponse(surveyResponse)

    if (created instanceof Error) {
      return created
    }

    if ("reason" in created) {
      if (created.reason === "survey_not_open") {
        return { reason: "survey_not_open" }
      }

      return created
    }

    if (created.id === null) {
      return new Error("failed to submit survey response")
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
