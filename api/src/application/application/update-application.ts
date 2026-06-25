import type { Application } from "@/domain/application/application.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicationId: number
  applicantId: number
  payload: unknown
}

/**
 * 申請内容を更新する。本人以外の変更と、審査済み（pending 以外）の変更を拒否する。
 */
export class UpdateApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Application | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    if (current.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "pending") {
      return new ConflictError("application is already decided", "not_pending")
    }

    const updated = await applicationRepository.updatePayload(current.withPayload(command.payload))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update application", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("application is already decided", "not_pending")
    }

    return updated
  }
}
