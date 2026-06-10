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

    // career_applications（withdrawn/rejected）と career_postings を D1 batch でアトミックに削除する。
    // この時点で applied の応募が 0 であることは確認済みのため、全応募を安全に削除できる。
    try {
      const db = this.c.env.DB
      await db.batch([
        db.prepare("DELETE FROM career_applications WHERE posting_id = ?1").bind(command.postingId),
        db.prepare("DELETE FROM career_postings WHERE id = ?1").bind(command.postingId),
      ])
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete career posting")
    }

    return { reason: "deleted" }
  }
}
