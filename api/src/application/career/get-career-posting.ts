import { canManageCareerPostings } from "@/domain/career/can-manage-career-postings"
import type { CareerPosting } from "@/domain/career/career-posting"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/infrastructure/career/career-posting-repository"

export type Command = {
  viewerRole: string
  postingId: number
}

export type Forbidden = { reason: "forbidden" }

export type PostingNotFound = { reason: "posting_not_found" }

/**
 * 社内公募を1件取得する。管理ロールのみ閲覧できる。
 */
export class GetCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | Forbidden | PostingNotFound | Error> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (canManageCareerPostings(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const posting = await postingRepository.findById(command.postingId)

    if (posting instanceof Error) {
      return posting
    }

    if (posting === null) {
      return { reason: "posting_not_found" }
    }

    return posting
  }
}
