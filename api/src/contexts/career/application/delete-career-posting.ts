import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/career-posting.repository"

export type Command = {
  session: Session
  postingId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 管理ロールが社内公募を削除する。
 * status='applied' の応募が存在する場合は削除を拒否する。
 * チェックと削除を単一の DELETE ... WHERE NOT EXISTS で実行し、
 * 間に応募が入るレースコンディションを防ぐ。
 */
export class DeleteCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (command.session.hasPermission("career_posting:manage") === false) {
      return new ForbiddenError("cannot manage career postings", "forbidden")
    }

    const current = await postingRepository.findById(command.postingId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find career posting", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("career posting not found", "posting_not_found")
    }

    const result = await postingRepository.deleteIfNoAppliedApplications(command.postingId)

    if (result instanceof Error) {
      return new UnexpectedError("failed to delete career posting", { cause: result })
    }

    if (result === null) {
      return new ConflictError(
        "career posting has applied applications",
        "has_applied_applications",
      )
    }

    return { reason: "deleted" }
  }
}
