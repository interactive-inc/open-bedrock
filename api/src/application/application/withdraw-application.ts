import type { ApplicationNotFound } from "@/lib/application/application-not-found"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

export type NotApplicant = { reason: "not_applicant" }

export type NotPending = { reason: "not_pending" }

export type Withdrawn = { reason: "withdrawn" }

/**
 * 申請を取り下げる。本人以外の取り下げと、審査済み（pending 以外）の取り下げを拒否する。
 */
export class WithdrawApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Withdrawn | ApplicationNotFound | NotApplicant | NotPending | Error> {
    const applicationRepository = new ApplicationRepository(this.c)

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

    if (current.status !== "pending") {
      return { reason: "not_pending" }
    }

    const deleted = await applicationRepository.delete(command.applicationId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_pending" }
    }

    return { reason: "withdrawn" }
  }
}
