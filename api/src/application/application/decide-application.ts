import { canDecideApplication } from "@/lib/application/can-decide-application"
import { ApplicationApproval } from "@/domain/application/application-approval.entity"
import type { ApplicationNotFound } from "@/lib/application/application-not-found"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"

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
 * 申請のステータスを pending からの条件付き UPDATE で確定し、承認記録を同時に INSERT する。
 * D1 batch で status UPDATE と approval INSERT をアトミックに行うため、
 * status だけ確定し承認記録が欠損する不整合は起きない。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 */
export class DecideApplication {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    ApplicationDecision | ApplicationNotFound | AlreadyDecided | { reason: "forbidden" } | Error
  > {
    const applicationRepository = new ApplicationRepository(this.c)

    const existing = await applicationRepository.findById(command.applicationId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "application_not_found" }
    }

    const applicationTemplateRepository = new ApplicationTemplateRepository(this.c)

    const template = await applicationTemplateRepository.findById(existing.templateId)

    if (template instanceof Error) return template

    if (template === null) return new Error("template not found")

    // approverRoles が指定されていれば、そのロールのみ承認可能
    if (template.approverRoles.length > 0) {
      if (!template.approverRoles.includes(command.viewerRole)) {
        return { reason: "forbidden" } as const
      }
    } else {
      // approverRoles が空なら従来の canDecideApplication チェック
      if (canDecideApplication(command.viewerRole) === false) {
        return { reason: "forbidden" } as const
      }
    }

    if (existing.applicantId === command.approverId) {
      return { reason: "forbidden" } as const
    }

    if (existing.status !== "pending") {
      return { reason: "already_decided" } as const
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const approval = ApplicationApproval.create({
      applicationId: command.applicationId,
      approverId: command.approverId,
      action: command.action,
      comment: command.comment,
      createdAt: command.createdAt,
    })

    const decided = await applicationRepository.decideFromPendingWithApproval({
      applicationId: command.applicationId,
      status: nextStatus,
      approval,
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

    return { status: decided.status }
  }
}
