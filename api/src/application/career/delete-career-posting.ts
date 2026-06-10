import { canManageCareerPostings } from "@/domain/career/can-manage-career-postings"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"
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
 */
export class DeleteCareerPosting {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Deleted | Forbidden | PostingNotFound | HasAppliedApplications | Error> {
    const postingRepository = new CareerPostingRepository(this.c)
    const applicationRepository = new CareerApplicationRepository(this.c)

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

    const appliedCount = await applicationRepository.countByPostingIdAndStatus(
      command.postingId,
      "applied",
    )

    if (appliedCount instanceof Error) {
      return appliedCount
    }

    if (appliedCount > 0) {
      return { reason: "has_applied_applications" }
    }

    const deleted = await postingRepository.delete(command.postingId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
