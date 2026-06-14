import type { Application } from "@/domain/application/application.entity"
import type { ApplicationNotFound } from "@/lib/application/application-not-found"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

export type NotApplicant = { reason: "not_applicant" }

/**
 * 申請を 1 件取得する。本人以外の閲覧を拒否する。
 */
export class GetApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Application | ApplicationNotFound | NotApplicant | Error> {
    const applicationRepository = new ApplicationRepository(this.c)

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
