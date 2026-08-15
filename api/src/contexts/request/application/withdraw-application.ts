import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationRepository } from "@/contexts/request/infrastructure/application-repository"

export type Command = {
  applicationId: number
  applicantId: number
}

export type Withdrawn = { reason: "withdrawn" }

/**
 * 申請を取り下げる。本人以外の取り下げと、審査済み（pending 以外）の取り下げを拒否する。
 */
export class WithdrawApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Withdrawn | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    if (current.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "pending") {
      return new ConflictError("application is already decided", "not_pending")
    }

    const systemBinding = await this.c.env.DB.prepare(
      "SELECT 1 AS found FROM application_completion_bindings WHERE application_id = ?1",
    )
      .bind(command.applicationId)
      .first<number>("found")
    if (systemBinding === 1) {
      return new ConflictError(
        "system application must use its dedicated withdrawal route",
        "system_template_requires_dedicated_route",
      )
    }

    const deleted = await applicationRepository.delete(command.applicationId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete application", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("application is already decided", "not_pending")
    }

    return { reason: "withdrawn" }
  }
}
