import type { CareerApplication } from "@/contexts/company/domain/career/career-application.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/contexts/company/infrastructure/career/career-application-repository"

export type Command = {
  applicantId: number
  limit: number
  offset: number
}

/**
 * 応募者本人の公募応募を一覧する。
 */
export class ListMyCareerApplications {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<CareerApplication> | ApplicationError> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    const applications = await applicationRepository.findByApplicantId({
      applicantId: command.applicantId,
      limit: command.limit,
      offset: command.offset,
    })

    if (applications instanceof Error) {
      return new UnexpectedError("failed to find career applications", { cause: applications })
    }

    return applications
  }
}
