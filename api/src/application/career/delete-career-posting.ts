import { canManageCareerPostings } from "@/domain/career/can-manage-career-postings"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/infrastructure/career/career-posting-repository"

export type Command = {
  viewerRole: string
  postingId: number
}

export type Forbidden = { reason: "forbidden" }

export type PostingNotFound = { reason: "posting_not_found" }

export type HasAppliedApplications = { reason: "has_applied_applications" }

export type Deleted = { reason: "deleted" }

/**
 * 管理ロールが社内公募を削除する。
 * status='applied' の応募が存在する場合は削除を拒否する。
 * チェックと削除を単一の DELETE ... WHERE NOT EXISTS で実行し、
 * 間に応募が入るレースコンディションを防ぐ。
 */
export class DeleteCareerPosting {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Deleted | Forbidden | PostingNotFound | HasAppliedApplications | Error> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (canManageCareerPostings(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const current = await postingRepository.findById(command.postingId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "posting_not_found" }
    }

    const result = await postingRepository.deleteIfNoAppliedApplications(command.postingId)

    if (result instanceof Error) {
      return result
    }

    if (result === "has_applied") {
      return { reason: "has_applied_applications" }
    }

    return { reason: "deleted" }
  }
}
