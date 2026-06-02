import type { Application } from "@/domain/application/application"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicantId: number
}

/**
 * 申請者本人の申請一覧を返す。
 */
export class ListMyApplications {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<Application> | Error> {
    const applicationRepository = new ApplicationRepository(this.c)

    return await applicationRepository.findByApplicantId(command.applicantId)
  }
}
