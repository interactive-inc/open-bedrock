import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

export type ApplicationNotFound = { reason: "application_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type ApplicationDecided = { reason: "application_decided" }

export type Withdrawn = { reason: "withdrawn" }

/**
 * 公募応募を取り下げる。本人以外と、合否確定済みの応募の取り下げを拒否する。
 */
export class WithdrawCareerApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Withdrawn | ApplicationNotFound | NotApplicant | ApplicationDecided | Error> {
    const applicationRepository = new CareerApplicationRepository(this.c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "application_not_found" }
    }

    if (current.applicantId !== command.applicantId) {
      return { reason: "not_applicant" }
    }

    if (current.status !== "applied") {
      return { reason: "application_decided" }
    }

    const deleted = await applicationRepository.delete(command.applicationId)

    if (deleted instanceof Error) {
      return deleted
    }

    // リポジトリ層の status guard で並行変更を検出した場合
    if (deleted !== null && "reason" in deleted) {
      return { reason: "application_decided" }
    }

    return { reason: "withdrawn" }
  }
}
