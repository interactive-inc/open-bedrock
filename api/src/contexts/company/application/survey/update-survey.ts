import type { Session } from "@/contexts/company/domain/iam/session"
import type { Survey } from "@/contexts/company/domain/survey/survey.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/contexts/company/infrastructure/survey/survey-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  surveyId: number
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

/**
 * 管理権限を持つ者がアンケートの内容を変更する。
 */
export class UpdateSurvey {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Survey | ApplicationError> {
    if (command.session.hasPermission("survey:manage") === false) {
      return new ForbiddenError("cannot manage surveys", "forbidden")
    }

    const surveyRepository = new SurveyRepository(this.c)

    const current = await surveyRepository.findById(command.surveyId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    // closed → open の再開は禁止。回答済みデータとの整合性を壊さないための防御。
    if (current.status === "closed" && command.status === "open") {
      return new ConflictError("closed survey cannot be reopened", "survey_reopen_forbidden")
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

      if (result instanceof Error) {
        return new UnexpectedError("failed to update survey", { cause: result })
      }

      if (result === null) {
        return new ConflictError("survey questions are not modifiable", "questions_immutable")
      }

      return result
    }

    const result = await surveyRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update survey", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    return result
  }
}
