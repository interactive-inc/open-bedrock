import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

export type Withdrawn = { reason: "withdrawn" }

/**
 * 公募応募を取り下げる。本人以外と、合否確定済みの応募の取り下げを拒否する。
 */
export class WithdrawCareerApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Withdrawn | ApplicationError> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find career application", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("career application not found", "application_not_found")
    }

    if (current.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "applied") {
      return new ConflictError("career application is already decided", "application_decided")
    }

    const deleted = await applicationRepository.delete(command.applicationId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete career application", { cause: deleted })
    }

    // リポジトリ層の status guard で並行変更を検出した場合
    if (deleted !== null && "reason" in deleted) {
      return new ConflictError("career application is already decided", "application_decided")
    }

    return { reason: "withdrawn" }
  }
}
