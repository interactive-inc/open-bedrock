import { canManageSurveys } from "@/domain/survey/can-manage-surveys"
import type { Survey } from "@/domain/survey/survey"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"

export type Command = {
  viewerRole: string
  surveyId: number
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

export type Forbidden = { reason: "forbidden" }

export type SurveyNotFound = { reason: "survey_not_found" }

export type QuestionsImmutable = { reason: "questions_immutable" }

export type UpdateFailure = Forbidden | SurveyNotFound | QuestionsImmutable

/**
 * 管理権限を持つ者がアンケートの内容を変更する。
 */
export class UpdateSurvey {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Survey | UpdateFailure | Error> {
    if (canManageSurveys(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const surveyRepository = new SurveyRepository(this.c)

    const current = await surveyRepository.findById(command.surveyId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "survey_not_found" }
    }

    const updated = current.withDetails({
      title: command.title,
      status: command.status,
      questionsJson: command.questionsJson,
    })

    const questionsChanged =
      JSON.stringify(command.questionsJson) !== JSON.stringify(current.questionsJson)

    if (questionsChanged) {
      const result = await surveyRepository.updateIfNoResponses(updated)

      if (result === null) {
        return { reason: "questions_immutable" }
      }

      return result
    }

    const result = await surveyRepository.update(updated)

    if (result === null) {
      return { reason: "survey_not_found" }
    }

    return result
  }
}
