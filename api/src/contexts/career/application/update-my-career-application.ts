import type { CareerApplication } from "@/contexts/career/domain/career-application.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/career-application.repository"

export type Command = {
  applicationId: number
  applicantId: number
  message: string | null
}

/**
 * 応募メッセージを変更する。本人以外と、合否確定済みの応募の変更を拒否する。
 */
export class UpdateMyCareerApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerApplication | ApplicationError> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find career application", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("career application not found", "application_not_found")
    }

    if (current.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "applied") {
      return new ConflictError("career application is already decided", "application_decided")
    }

    const updated = await applicationRepository.update(current.withMessage(command.message))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update career application", { cause: updated })
    }

    // リポジトリ層の status guard で並行変更を検出した場合
    if ("reason" in updated) {
      return new ConflictError("career application is already decided", "application_decided")
    }

    return updated
  }
}
