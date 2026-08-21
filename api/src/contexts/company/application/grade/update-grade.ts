import type { Session } from "@/contexts/company/domain/iam/session"
import { Grade } from "@/contexts/company/domain/grade/grade.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { GradeRepository } from "@/contexts/company/infrastructure/grade/grade.repository"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"

export type Command = {
  session: Session
  gradeId: number
  code: string
  name: string
  rank: number
  description: string | null
}

/**
 * 権限を確認し、等級マスタの定義を差し替える。
 */
export class UpdateGrade {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Grade | ApplicationError> {
    const repository = new GradeRepository(this.c)

    if (command.session.hasPermission("grade:manage") === false) {
      return new ForbiddenError("cannot manage grades", "forbidden")
    }

    const existing = await repository.findById(command.gradeId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find grade", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("grade not found", "grade_not_found")
    }

    const grade = existing.withDetails({
      code: command.code,
      name: command.name,
      rank: command.rank,
      description: command.description,
    })

    const updated = await repository.update(grade)

    if (updated instanceof UniqueConstraintError) {
      return new ConflictError("grade code already exists", "grade_code_conflict")
    }

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update grade", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("grade not found", "grade_not_found")
    }

    return updated
  }
}
