import { GradeEntity } from "@/contexts/company/domain/entities/grade.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUniqueConstraintError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { GradeRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: GradeRepository }>

export class UpdateGrade {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: {
    id: number
    details: Pick<ReturnType<GradeEntity["toProps"]>, "code" | "name" | "rank" | "description">
  }): Promise<GradeEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("master:org:write")) return new CompanyForbiddenError()
    const current = await this.c.repository.findById(input.id)
    if (current instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company grade", { cause: current })
    }
    if (current === null) return new CompanyNotFoundError("grade not found", "grade_not_found")
    const updated = await this.c.repository.update(current.withDetails(input.details))
    if (updated instanceof CompanyUniqueConstraintError) {
      return new CompanyConflictError("grade code already exists", "grade_code_conflict")
    }
    if (updated instanceof Error) {
      return new CompanyUnexpectedError("failed to update Company grade", { cause: updated })
    }
    return updated ?? new CompanyNotFoundError("grade not found", "grade_not_found")
  }
}
