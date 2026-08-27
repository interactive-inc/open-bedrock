import { EmployeeGradeEntity } from "@/contexts/company/domain/entities/employee-grade.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUniqueConstraintError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { EmployeeGradeRepository } from "@/contexts/company/infrastructure/repositories/employee-history/employee-grade.repository"
import type { GradeRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade.repository"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: EmployeeGradeRepository
  gradeRepository: GradeRepository
}>

export class CreateEmployeeGrade {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: Omit<ReturnType<EmployeeGradeEntity["toProps"]>, "id">,
  ): Promise<EmployeeGradeEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("employee:write:attributes")) return new CompanyForbiddenError()
    const grade = await this.c.gradeRepository.findById(input.gradeId)
    if (grade instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company grade", { cause: grade })
    }
    if (grade === null) return new CompanyNotFoundError("grade not found", "grade_not_found")
    const created = await this.c.repository.create(EmployeeGradeEntity.create(input))
    if (created instanceof CompanyUniqueConstraintError) {
      return new CompanyConflictError("employee grade already exists", "employee_grade_conflict")
    }
    return created instanceof Error
      ? new CompanyUnexpectedError("failed to create Company employee grade", { cause: created })
      : created
  }
}
