import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"
import type { CareerPosting } from "@/domain/career/career-posting.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { CareerPostingRepository } from "@/infrastructure/career/career-posting-repository"

export type Command = {
  session: SessionPayload
  postingId: number
}

/**
 * 社内公募を1件取得する。管理ロールのみ閲覧できる。
 */
export class GetCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (canManageCareerPostings(command.session) === false) {
      return new ForbiddenError("cannot manage career postings", "forbidden")
    }

    const posting = await postingRepository.findById(command.postingId)

    if (posting instanceof Error) {
      return new UnexpectedError("failed to find career posting", { cause: posting })
    }

    if (posting === null) {
      return new NotFoundError("career posting not found", "posting_not_found")
    }

    return posting
  }
}
