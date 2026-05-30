import { ApplicationApproval } from "@/domain/application/application-approval"
import type { ApplicationNotFound } from "@/domain/application/application-not-found"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  applicationId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type ApplicationDecision = {
  status: "pending" | "approved" | "rejected"
}

/**
 * 承認/却下を記録し、申請のステータスを更新する。
 */
export class DecideApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationDecision | ApplicationNotFound | Error> {
    const applicationRepository = new ApplicationRepository(this.c)

    const existing = await applicationRepository.findById(command.applicationId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "application_not_found" }
    }

    const approval = await applicationRepository.addApproval(
      ApplicationApproval.create({
        applicationId: command.applicationId,
        approverId: command.approverId,
        action: command.action,
        comment: command.comment,
        createdAt: command.createdAt,
      }),
    )

    if (approval instanceof Error) {
      return approval
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const updated = await applicationRepository.update(
      existing.withStatus(nextStatus).withCurrentStep(null),
    )

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "application_not_found" }
    }

    return { status: updated.status }
  }
}
