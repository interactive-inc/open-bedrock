import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import { isSurveyRecordSourceFrozenError } from "@/contexts/survey/infrastructure/repositories/lib/is-survey-record-source-frozen-error"
import type { Survey } from "@/contexts/survey/domain/entities/survey.entity"

type Context = Readonly<{
  surveyRepository: Pick<SurveyRepository, "findById" | "deleteWithResponses">
}>

export type Command = {
  session: CompanySessionValue
  surveyId: string
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者がアンケートを削除する。
 * 本体をガード付きで削除してから関連する回答（survey_responses）を削除する。
 */
export class DeleteSurvey {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Deleted | ApplicationError> {
    if (command.session.hasPermission("survey:manage") === false) {
      return new ForbiddenError("cannot manage surveys", "forbidden")
    }

    const current: Survey | null | Error = await this.c.surveyRepository.findById(command.surveyId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    if (current.isOpen()) {
      return new ConflictError("open survey cannot be deleted", "not_deletable")
    }

    const deleted = await this.c.surveyRepository.deleteWithResponses(current)

    if (deleted instanceof Error) {
      if (isSurveyRecordSourceFrozenError(deleted)) {
        return new ConflictError("survey writes are frozen", "record_source_frozen", {
          cause: deleted,
        })
      }
      return new UnexpectedError("failed to delete survey", { cause: deleted })
    }

    if (deleted !== true && deleted.reason === "not_deletable") {
      return new ConflictError("open survey cannot be deleted", "not_deletable")
    }

    if (deleted !== true && deleted.reason === "not_found") {
      return new ConflictError("survey was modified concurrently", "not_found")
    }

    return { reason: "deleted" }
  }
}
