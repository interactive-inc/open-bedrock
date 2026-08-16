import type { CareerPosting } from "@/contexts/career/domain/career-posting.entity"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/career-posting-repository"

export type Command = {
  postingId: number
}

/**
 * 社内公募を1件取得する。応募対象のため認証済みユーザーは閲覧できる。
 */
export class GetCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

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
