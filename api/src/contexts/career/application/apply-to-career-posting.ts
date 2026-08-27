import { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/repositories/career-application.repository"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"

export type Command = {
  postingId: number
  applicantId: number
  message: string | null
}

/**
 * 公募への応募を作成する。公募が公開中でない・重複応募は判別可能な失敗で返す。
 */
export class ApplyToCareerPosting {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<CareerApplication | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

    const applicationRepository = new CareerApplicationRepository(this.c)

    const posting = await postingRepository.findById(command.postingId)

    if (posting instanceof Error) {
      return new UnexpectedError("failed to find career posting", { cause: posting })
    }

    if (posting === null || posting.status !== "open") {
      return new NotFoundError("career posting is not open", "posting_not_open")
    }

    const existing = await applicationRepository.findByPostingAndApplicant(
      command.postingId,
      command.applicantId,
    )

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find career application", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("already applied to career posting", "already_applied")
    }

    const created = await applicationRepository.create(
      CareerApplication.create({
        postingId: command.postingId,
        applicantId: command.applicantId,
        message: command.message,
      }),
    )

    if (created instanceof Error) {
      return new UnexpectedError("failed to create career application", { cause: created })
    }

    // 条件付き INSERT で公募が closed に変更されていた場合
    if ("reason" in created && created.reason === "posting_closed") {
      return new NotFoundError("career posting is not open", "posting_not_open")
    }

    // 一意制約違反（並行リクエストによる二重応募）
    if ("reason" in created && created.reason === "already_applied") {
      return new ConflictError("already applied to career posting", "already_applied")
    }

    return created
  }
}
