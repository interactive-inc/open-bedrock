import type { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"

export type Command = {
  applicantId: number
}

/**
 * 応募者本人の公募応募を一覧する。
 */
export class ListMyCareerApplications {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<CareerApplication> | Error> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    return await applicationRepository.findByApplicantId(command.applicantId)
  }
}
