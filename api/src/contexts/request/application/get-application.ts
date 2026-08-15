import type { Application } from "@/contexts/request/domain/application.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/contexts/request/infrastructure/application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

/**
 * 申請を 1 件取得する。本人以外の閲覧を拒否する。
 */
export class GetApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Application | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const application = await applicationRepository.findById(command.applicationId)

    if (application instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: application })
    }

    if (application === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    if (application.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return application
  }
}
