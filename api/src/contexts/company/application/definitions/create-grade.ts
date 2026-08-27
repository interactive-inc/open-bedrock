import { GradeEntity } from "@/contexts/company/domain/entities/grade.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyOperationError,
  CompanyUniqueConstraintError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { GradeRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: GradeRepository }>

export class CreateGrade {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: Omit<ReturnType<GradeEntity["toProps"]>, "id">,
  ): Promise<GradeEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("master:org:write")) return new CompanyForbiddenError()
    const created = await this.c.repository.create(GradeEntity.create(input))
    if (created instanceof CompanyUniqueConstraintError) {
      return new CompanyConflictError("grade code already exists", "grade_code_conflict")
    }
    return created instanceof Error
      ? new CompanyUnexpectedError("failed to create Company grade", { cause: created })
      : created
  }
}
