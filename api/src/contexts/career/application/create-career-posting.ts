import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"

export type Command = {
  session: CompanySessionValue
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
