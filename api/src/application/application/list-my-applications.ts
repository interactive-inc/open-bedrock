import type { Application } from "@/domain/application/application.entity"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicantId: number
  limit?: number
  offset?: number
}

/**
 * 申請者本人の申請一覧を返す。
 */
export class ListMyApplications {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<Application> | Error> {
    const applicationRepository = new ApplicationRepository(this.c)

    const opts =
      command.limit !== undefined && command.offset !== undefined
        ? { limit: command.limit, offset: command.offset }
        : undefined

    return await applicationRepository.findByApplicantId(command.applicantId, opts)
  }
}
