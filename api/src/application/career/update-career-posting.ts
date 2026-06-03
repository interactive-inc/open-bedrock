import { canManageCareerPostings } from "@/domain/career/can-manage-career-postings"
import type { CareerPosting } from "@/domain/career/career-posting"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/infrastructure/career/career-posting-repository"

export type Command = {
  viewerRole: string
  postingId: number
  title: string
  deptId: number | null
  deptName: string | null
  requiredSkills: string | null
  status: "open" | "closed"
}

export type Forbidden = { reason: "forbidden" }

export type PostingNotFound = { reason: "posting_not_found" }

/**
 * 管理ロールが社内公募の内容と状態を変更する。
 */
export class UpdateCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | Forbidden | PostingNotFound | Error> {
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

    const updated = await postingRepository.update(
      current.withDetails({
        title: command.title,
        deptId: command.deptId,
        deptName: command.deptName,
        requiredSkills: command.requiredSkills,
        status: command.status,
      }),
    )

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "posting_not_found" }
    }

    return updated
  }
}
