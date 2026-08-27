import type { GradeEntity } from "@/contexts/company/domain/entities/grade.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { GradeRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: GradeRepository }>

export class DeleteGrade {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(id: number): Promise<GradeEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("master:org:write")) return new CompanyForbiddenError()
    const current = await this.c.repository.findById(id)
    if (current instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company grade", { cause: current })
    }
    if (current === null) return new CompanyNotFoundError("grade not found", "grade_not_found")
    const usage = await this.c.repository.countAssignments(id)
    if (usage instanceof Error) {
      return new CompanyUnexpectedError("failed to inspect Company grade usage", { cause: usage })
    }
    if (usage > 0) return new CompanyConflictError("grade is in use", "grade_in_use")
    const deleted = await this.c.repository.delete(current)
    if (deleted instanceof Error) {
      return new CompanyUnexpectedError("failed to delete Company grade", { cause: deleted })
    }
    return deleted ? current : new CompanyNotFoundError("grade not found", "grade_not_found")
  }
}
