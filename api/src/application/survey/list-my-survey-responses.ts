import type { SurveyResponse } from "@/domain/survey/survey-response"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

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

  async run(command: Command): Promise<ReadonlyArray<SurveyResponse> | Error> {
    const surveyRepository = new SurveyRepository(this.c)

    return await surveyRepository.findResponsesByRespondentId(
      command.respondentId,
      command.limit,
      command.offset,
    )
  }
}
