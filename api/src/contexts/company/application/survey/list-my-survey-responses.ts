import type { SurveyResponse } from "@/contexts/company/domain/survey/survey-response.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/contexts/company/infrastructure/survey/survey-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  respondentId: number
  limit: number
  offset: number
}

/**
 * 回答者本人のアンケート回答を一覧する。
 */
export class ListMySurveyResponses {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<SurveyResponse> | ApplicationError> {
    const surveyRepository = new SurveyRepository(this.c)

    const responses = await surveyRepository.findResponsesByRespondentId(
      command.respondentId,
      command.limit,
      command.offset,
    )

    if (responses instanceof Error) {
      return new UnexpectedError("failed to find survey responses", { cause: responses })
    }

    return responses
  }
}
