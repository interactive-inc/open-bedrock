import { canManageSurveys } from "@/domain/survey/can-manage-surveys"
import { Survey } from "@/domain/survey/survey"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  viewerRole: string
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

export type Forbidden = { reason: "forbidden" }

/**
 * 管理権限を持つ者が新しいアンケートを作成する。
 */
export class CreateSurvey {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Survey | Forbidden | Error> {
    if (canManageSurveys(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const surveyRepository = new SurveyRepository(this.c)

    const survey = Survey.create({
      title: command.title,
      status: command.status,
      questionsJson: command.questionsJson,
    })

    return surveyRepository.create(survey)
  }
}
