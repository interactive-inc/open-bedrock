import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import type { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import { isSurveyRecordSourceFrozenError } from "@/contexts/survey/infrastructure/repositories/lib/is-survey-record-source-frozen-error"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

type Context = Readonly<{
  surveyRepository: Pick<SurveyRepository, "create">
}>

export type Command = {
  session: CompanySessionValue
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

/**
 * 管理権限を持つ者が新しいアンケートを作成する。
 */
export class CreateSurvey {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Survey | ApplicationError> {
    if (command.session.hasPermission("survey:manage") === false) {
      return new ForbiddenError("cannot manage surveys", "forbidden")
    }

    const survey = Survey.create({
      title: command.title,
      status: command.status,
      questionsJson: command.questionsJson,
    })

    const created = await this.c.surveyRepository.create(survey)

    if (created instanceof Error) {
      if (isSurveyRecordSourceFrozenError(created)) {
        return new ConflictError("survey writes are frozen", "record_source_frozen", {
          cause: created,
        })
      }
      return new UnexpectedError("failed to create survey", { cause: created })
    }

    return created
  }
}
