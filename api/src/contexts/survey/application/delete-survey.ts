import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import type { Survey } from "@/contexts/survey/domain/entities/survey.entity"

export type Command = {
  session: Session
  surveyId: number
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

    const surveyRepository = new SurveyRepository(this.c)

    const current: Survey | null | Error = await surveyRepository.findById(command.surveyId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey not found", "survey_not_found")
    }

    if (current.isOpen()) {
      return new ConflictError("open survey cannot be deleted", "not_deletable")
    }

    const deleted = await surveyRepository.deleteWithResponses(current)

    if (deleted instanceof Error) {
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
