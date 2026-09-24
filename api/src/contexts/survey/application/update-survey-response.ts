import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import type { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import { isSurveyRecordSourceFrozenError } from "@/contexts/survey/infrastructure/repositories/lib/is-survey-record-source-frozen-error"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

type Context = Readonly<{
  surveyRepository: Pick<SurveyRepository, "findResponseById" | "findById" | "updateResponse">
}>

export type Command = {
  responseId: number
  respondentId: EmployeeId
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
    const current = await this.c.surveyRepository.findResponseById(command.responseId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey response", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (current.respondentId !== command.respondentId) {
      return new ForbiddenError("not the respondent", "not_respondent")
    }

    const survey = await this.c.surveyRepository.findById(current.surveyId)

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

    const result = await this.c.surveyRepository.updateResponse(updated)

    if (result instanceof Error) {
      if (isSurveyRecordSourceFrozenError(result)) {
        return new ConflictError("survey writes are frozen", "record_source_frozen", {
          cause: result,
        })
      }
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
