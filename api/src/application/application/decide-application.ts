import { canDecideApplication } from "@/domain/application/can-decide-application"
import { ApplicationApproval } from "@/domain/application/application-approval"
import type { ApplicationNotFound } from "@/domain/application/application-not-found"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"

export type Command = {
  viewerRole: string
  applicationId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type ApplicationDecision = {
  status: "pending" | "approved" | "rejected"
}

export type AlreadyDecided = { reason: "already_decided" }

/**
 * 申請のステータスを pending からの条件付き UPDATE で確定し、勝った場合のみ承認/却下を記録する。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 * 確定後に addApproval が失敗した場合は status のみ確定し承認記録が欠損しうる（D1 に
 * 対話的トランザクションが無いことによる許容済みトレードオフ。Error は呼び出し元へ伝播する）。
 */
export class DecideApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    ApplicationDecision | ApplicationNotFound | AlreadyDecided | { reason: "forbidden" } | Error
  > {
    if (canDecideApplication(command.viewerRole) === false) {
      return { reason: "forbidden" } as const
    }

    const applicationRepository = new ApplicationRepository(this.c)

    const existing = await applicationRepository.findById(command.applicationId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "application_not_found" }
    }

    if (existing.applicantId === command.approverId) {
      return { reason: "forbidden" } as const
    }

    if (existing.status !== "pending") {
      return { reason: "already_decided" } as const
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const decided = await applicationRepository.decideFromPending({
      applicationId: command.applicationId,
      status: nextStatus,
    })

    if (decided instanceof Error) {
      return decided
    }

    if (decided === null) {
      // 条件付き UPDATE が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
      const current = await applicationRepository.findById(command.applicationId)

      if (current instanceof Error) {
        return current
      }

      if (current === null) {
        return { reason: "application_not_found" }
      }

      return { reason: "already_decided" } as const
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

    return { status: decided.status }
  }
}
