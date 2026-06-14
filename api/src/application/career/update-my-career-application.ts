import type { CareerApplication } from "@/domain/career/career-application.entity"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"

export type Command = {
  applicationId: number
  applicantId: number
  message: string | null
}

export type ApplicationNotFound = { reason: "application_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type ApplicationDecided = { reason: "application_decided" }

/**
 * 応募メッセージを変更する。本人以外と、合否確定済みの応募の変更を拒否する。
 */
export class UpdateMyCareerApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<CareerApplication | ApplicationNotFound | NotApplicant | ApplicationDecided | Error> {
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

    const updated = await applicationRepository.update(current.withMessage(command.message))

    // リポジトリ層の status guard で並行変更を検出した場合
    if (!(updated instanceof Error) && "reason" in updated) {
      return { reason: "application_decided" }
    }

    return updated
  }
}
