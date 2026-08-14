import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { GradeRepository } from "@/contexts/company/infrastructure/grade/grade-repository"

export type Command = {
  session: Session
  gradeId: number
}

/**
 * 権限を確認し、等級マスタから1件削除する。
 */
export class DeleteGrade {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<null | ApplicationError> {
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

    const deleted = await repository.delete(command.gradeId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete grade", { cause: deleted })
    }

    return null
  }
}
