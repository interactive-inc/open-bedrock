import { canDecideApplication } from "@/lib/application/can-decide-application"
import { ApplicationApproval } from "@/domain/application/application-approval.entity"
import type { Context, SessionPayload } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: SessionPayload
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
 * 申請のステータスを pending からの条件付き UPDATE で確定し、承認記録を同時に INSERT する。
 * D1 batch で status UPDATE と approval INSERT をアトミックに行うため、
 * status だけ確定し承認記録が欠損する不整合は起きない。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 */
export class DecideApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationDecision | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const existing = await applicationRepository.findById(command.applicationId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    const applicationTemplateRepository = new ApplicationTemplateRepository(this.c)

    const template = await applicationTemplateRepository.findById(existing.templateId)

    if (template instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: template })
    }

    if (template === null) {
      return new UnexpectedError("template not found")
    }

    // approverRoles が指定されていれば、そのいずれかのロールを持つアカウントのみ承認可能。
    // 複数ロールを持つアカウントは roleKeys のいずれかが一致すればよい。
    if (template.approverRoles.length > 0) {
      const matches = command.session.roleKeys.some((roleKey) =>
        template.approverRoles.includes(roleKey),
      )

      if (matches === false) {
        return new ForbiddenError("cannot decide application", "forbidden")
      }
    } else {
      // approverRoles が空なら従来の canDecideApplication チェック
      if (canDecideApplication(command.session) === false) {
        return new ForbiddenError("cannot decide application", "forbidden")
      }
    }

    if (existing.applicantId === command.approverId) {
      return new ForbiddenError("cannot decide own application", "forbidden")
    }

    if (existing.status !== "pending") {
      return new ConflictError("application is already decided", "already_decided")
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
      return new UnexpectedError("failed to decide application", { cause: decided })
    }

    if (decided === null) {
      // 条件付き UPDATE が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
      const current = await applicationRepository.findById(command.applicationId)

      if (current instanceof Error) {
        return new UnexpectedError("failed to find application", { cause: current })
      }

      if (current === null) {
        return new NotFoundError("application not found", "application_not_found")
      }

      return new ConflictError("application is already decided", "already_decided")
    }

    return { status: decided.status }
  }
}
