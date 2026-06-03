import type { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

export type ApplicationNotFound = { reason: "application_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * 公募応募を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetCareerApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<CareerApplication | ApplicationNotFound | NotApplicant | Error> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    const application = await applicationRepository.findById(command.applicationId)

    if (application instanceof Error) {
      return application
    }

    if (application === null) {
      return { reason: "application_not_found" }
    }

    if (application.applicantId !== command.applicantId) {
      return { reason: "not_applicant" }
    }

    return application
  }
}
