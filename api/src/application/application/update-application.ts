import type { Application } from "@/domain/application/application.entity"
import type { ApplicationNotFound } from "@/lib/application/application-not-found"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicationId: number
  applicantId: number
  payload: unknown
}

export type NotApplicant = { reason: "not_applicant" }

export type NotPending = { reason: "not_pending" }

/**
 * 申請内容を更新する。本人以外の変更と、審査済み（pending 以外）の変更を拒否する。
 */
export class UpdateApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Application | ApplicationNotFound | NotApplicant | NotPending | Error> {
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

    const updated = await applicationRepository.updatePayload(current.withPayload(command.payload))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "not_pending" }
    }

    return updated
  }
}
