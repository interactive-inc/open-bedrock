import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Context as HonoContext } from "@/env"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: CompanySessionValue
  ringiId: number
  approverId: EmployeeId
  comment: string | null
  createdAt: string
}

export type RingiDecision = {
  status: "pending" | "approved" | "rejected"
}

type Context = Readonly<{
  context: HonoContext
  notifyApprovalResult?: (command: {
    recipientEmployeeId: EmployeeId
    action: "approve" | "reject"
    subjectLabel: string
    sourceDomain: string
    sourceId: number | null
    createdAt: string
  }) => Promise<unknown>
}>

/** 稟議を却下する。 */
export class RejectRingi {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<RingiDecision | ApplicationError> {
    const repository = new RingiRequestRepository(this.c.context)

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

    const nextStatus = "rejected" as const

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
    await this.c.notifyApprovalResult?.({
      recipientEmployeeId: existing.applicantId,
      action: "reject",
      subjectLabel: "稟議",
      sourceDomain: "ringi",
      sourceId: command.ringiId,
      createdAt: command.createdAt,
    })

    return { status: decided.status }
  }
}
