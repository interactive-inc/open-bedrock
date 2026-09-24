import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import type { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import { isSurveyRecordSourceFrozenError } from "@/contexts/survey/infrastructure/repositories/lib/is-survey-record-source-frozen-error"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

type Context = Readonly<{
  surveyRepository: Pick<SurveyRepository, "findById" | "updateIfNoResponses" | "update">
}>

export type Command = {
  session: CompanySessionValue
  surveyId: number
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

/**
 * 管理権限を持つ者がアンケートの内容を変更する。
 */
export class UpdateSurvey {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Survey | ApplicationError> {
    if (command.session.hasPermission("survey:manage") === false) {
      return new ForbiddenError("cannot manage surveys", "forbidden")
    }

    const current = await this.c.surveyRepository.findById(command.surveyId)

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
      const result = await this.c.surveyRepository.updateIfNoResponses(updated)

      if (result instanceof Error) {
        if (isSurveyRecordSourceFrozenError(result)) {
          return new ConflictError("survey writes are frozen", "record_source_frozen", {
            cause: result,
          })
        }
        return new UnexpectedError("failed to update survey", { cause: result })
      }

      if (result === null) {
        return new ConflictError("survey questions are not modifiable", "questions_immutable")
      }

      return result
    }

    const result = await this.c.surveyRepository.update(updated)

    if (result instanceof Error) {
      if (isSurveyRecordSourceFrozenError(result)) {
        return new ConflictError("survey writes are frozen", "record_source_frozen", {
          cause: result,
        })
      }
      return new UnexpectedError("failed to update survey", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    return result
  }
}
