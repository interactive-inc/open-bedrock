import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { NotifyApprovalResult } from "@/contexts/company-compatibility/application/notification/notify-approval-result"
import type { Context } from "@/env"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/ringi-request-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  ringiId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type RingiDecision = {
  status: "pending" | "approved" | "rejected"
}

/**
 * 稟議のステータスを pending からの条件付き UPDATE で確定する。指名された承認者本人のみ決裁でき、
 * pending 以外からの遷移は 409 を返す。条件付き UPDATE で二重決定を防ぐ（TOCTOU 競合にも強い）。
 */
export class DecideRingi {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RingiDecision | ApplicationError> {
    const repository = new RingiRequestRepository(this.c)

    const existing = await repository.findById(command.ringiId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find ringi request", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("ringi request not found", "ringi_not_found")
    }

    if (existing.approverId !== command.approverId) {
      return new ForbiddenError("cannot decide ringi request", "forbidden")
    }

    if (existing.status !== "pending") {
      return new ConflictError("ringi request already decided", "already_decided")
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const decided = await repository.decideFromPending({
      ringiId: command.ringiId,
      status: nextStatus,
      decidedAt: command.createdAt,
      decisionComment: command.comment,
    })

    if (decided instanceof Error) {
      return new UnexpectedError("failed to decide ringi request", { cause: decided })
    }

    if (decided === null) {
      // 条件付き UPDATE が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
      const current = await repository.findById(command.ringiId)

      if (current instanceof Error) {
        return new UnexpectedError("failed to find ringi request", { cause: current })
      }

      if (current === null) {
        return new NotFoundError("ringi request not found", "ringi_not_found")
      }

      return new ConflictError("ringi request already decided", "already_decided")
    }

    // 決定は確定済みのため、起案者への結果通知が失敗しても決定は返す。
    await new NotifyApprovalResult(this.c).run({
      recipientEmployeeId: existing.applicantId,
      action: command.action,
      subjectLabel: "稟議",
      sourceDomain: "ringi",
      sourceId: command.ringiId,
      createdAt: command.createdAt,
    })

    return { status: decided.status }
  }
}
