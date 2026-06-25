import type { Application } from "@/domain/application/application.entity"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
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

  async run(command: Command): Promise<ReadonlyArray<Application> | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const opts =
      command.limit !== undefined && command.offset !== undefined
        ? { limit: command.limit, offset: command.offset }
        : undefined

    const applications = await applicationRepository.findByApplicantId(command.applicantId, opts)

    if (applications instanceof Error) {
      return new UnexpectedError("failed to find applications", { cause: applications })
    }

    return applications
  }
}
