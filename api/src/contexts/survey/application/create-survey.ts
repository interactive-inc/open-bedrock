import type { Session } from "@/contexts/company/domain/iam/session"
import { Survey } from "@/contexts/survey/domain/survey.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/contexts/survey/infrastructure/survey-repository"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

/**
 * 管理権限を持つ者が新しいアンケートを作成する。
 */
export class CreateSurvey {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Survey | ApplicationError> {
    if (command.session.hasPermission("survey:manage") === false) {
      return new ForbiddenError("cannot manage surveys", "forbidden")
    }

    const surveyRepository = new SurveyRepository(this.c)

    const survey = Survey.create({
      title: command.title,
      status: command.status,
      questionsJson: command.questionsJson,
    })

    const created = await surveyRepository.create(survey)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create survey", { cause: created })
    }

    return created
  }
}
