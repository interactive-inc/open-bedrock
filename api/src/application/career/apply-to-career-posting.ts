import { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"
import { CareerPostingRepository } from "@/infrastructure/career/career-posting-repository"

export type Command = {
  postingId: number
  applicantId: number
  message: string | null
}

export type PostingNotOpen = { reason: "posting_not_open" }

export type AlreadyApplied = { reason: "already_applied" }

/**
 * 公募への応募を作成する。公募が公開中でない・重複応募は判別可能な失敗で返す。
 */
export class ApplyToCareerPosting {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<CareerApplication | PostingNotOpen | AlreadyApplied | Error> {
    const postingRepository = new CareerPostingRepository(this.c)

    const applicationRepository = new CareerApplicationRepository(this.c)

    const posting = await postingRepository.findById(command.postingId)

    if (posting instanceof Error) {
      return posting
    }

    if (posting === null || posting.status !== "open") {
      return { reason: "posting_not_open" }
    }

    const existing = await applicationRepository.findByPostingAndApplicant(
      command.postingId,
      command.applicantId,
    )

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "already_applied" }
    }

    const created = await applicationRepository.create(
      CareerApplication.create({
        postingId: command.postingId,
        applicantId: command.applicantId,
        message: command.message,
      }),
    )

    if (created instanceof Error) {
      return created
    }

    return created
  }
}
