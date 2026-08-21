import type { Session } from "@/contexts/company/domain/iam/session"
import type { CareerPosting } from "@/contexts/career/domain/career-posting.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/career-posting.repository"

export type Command = {
  session: Session
  postingId: number
  title: string
  deptId: number | null
  deptName: string | null
  requiredSkills: string | null
  status?: "open" | "closed"
}

/**
 * 管理ロールが社内公募の内容と状態を変更する。
 */
export class UpdateCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | ApplicationError> {
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

    const updated = await postingRepository.update(
      current.withDetails({
        title: command.title,
        deptId: command.deptId,
        deptName: command.deptName,
        requiredSkills: command.requiredSkills,
        status: command.status ?? current.status,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update career posting", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("career posting not found", "posting_not_found")
    }

    return updated
  }
}
