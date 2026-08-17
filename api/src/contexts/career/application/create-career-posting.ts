import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { CareerPosting } from "@/contexts/career/domain/career-posting.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/career-posting-repository"

export type Command = {
  session: Session
  title: string
  deptId: number | null
  deptName: string | null
  requiredSkills: string | null
  status: "open" | "closed"
}

/**
 * 管理ロールが新しい社内公募を作成する。id は DB が採番する。
 */
export class CreateCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | ApplicationError> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (command.session.hasPermission("career_posting:manage") === false) {
      return new ForbiddenError("cannot manage career postings", "forbidden")
    }

    const careerPosting = CareerPosting.create({
      title: command.title,
      deptId: command.deptId,
      deptName: command.deptName,
      requiredSkills: command.requiredSkills,
      status: command.status,
    })

    const created = await postingRepository.create(careerPosting)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create career posting", { cause: created })
    }

    return created
  }
}
