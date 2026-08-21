import type { Session } from "@/lib/auth/session"
import { Grade } from "@/contexts/administration/domain/entities/grade.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { GradeRepository } from "@/contexts/administration/infrastructure/grade/grade.repository"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"

export type Command = {
  session: Session
  code: string
  name: string
  rank: number
  description: string | null
  createdAt: string
}

/**
 * 権限と重複コードを確認し、新しい等級をマスタに登録する。
 */
export class CreateGrade {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Grade | ApplicationError> {
    const repository = new GradeRepository(this.c)

    if (command.session.hasPermission("grade:manage") === false) {
      return new ForbiddenError("cannot manage grades", "forbidden")
    }

    const grade = Grade.create({
      code: command.code,
      name: command.name,
      rank: command.rank,
      description: command.description,
      createdAt: command.createdAt,
    })

    const created = await repository.create(grade)

    if (created instanceof UniqueConstraintError) {
      return new ConflictError("grade code already exists", "grade_code_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create grade", { cause: created })
    }

    return created
  }
}
