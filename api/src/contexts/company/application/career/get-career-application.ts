import type { CareerApplication } from "@/contexts/company/domain/career/career-application.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/contexts/company/infrastructure/career/career-application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

/**
 * 公募応募を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetCareerApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerApplication | ApplicationError> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    const application = await applicationRepository.findById(command.applicationId)

    if (application instanceof Error) {
      return new UnexpectedError("failed to find career application", { cause: application })
    }

    if (application === null) {
      return new NotFoundError("career application not found", "application_not_found")
    }

    if (application.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return application
  }
}
