import { canManageCareerPostings } from "@/domain/career/can-manage-career-postings"
import { CareerPosting } from "@/domain/career/career-posting"
import type { Context } from "@/env"
import { CareerPostingRepository } from "@/infrastructure/career/career-posting-repository"

export type Command = {
  viewerRole: string
  title: string
  deptId: number | null
  deptName: string | null
  requiredSkills: string | null
  status: "open" | "closed"
}

export type Forbidden = { reason: "forbidden" }

/**
 * 管理ロールが新しい社内公募を作成する。id は DB が採番する。
 */
export class CreateCareerPosting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerPosting | Forbidden | Error> {
    const postingRepository = new CareerPostingRepository(this.c)

    if (canManageCareerPostings(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const careerPosting = CareerPosting.create({
      title: command.title,
      deptId: command.deptId,
      deptName: command.deptName,
      requiredSkills: command.requiredSkills,
      status: command.status,
    })

    return postingRepository.create(careerPosting)
  }
}
