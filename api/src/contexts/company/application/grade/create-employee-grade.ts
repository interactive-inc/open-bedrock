import type { Session } from "@/contexts/company/domain/iam/session"
import { EmployeeGrade } from "@/contexts/company/domain/grade/employee-grade.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { EmployeeGradeRepository } from "@/contexts/company/infrastructure/grade/employee-grade-repository"
import { GradeRepository } from "@/contexts/company/infrastructure/grade/grade-repository"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"

export type Command = {
  session: Session
  employeeId: number
  gradeId: number
  effectiveDate: string
  reason: string | null
  createdAt: string
}

/**
 * 権限と等級の存在を確認し、社員の等級割当を1件記録する。
 */
export class CreateEmployeeGrade {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EmployeeGrade | ApplicationError> {
    if (command.session.hasPermission("grade:manage") === false) {
      return new ForbiddenError("cannot manage grades", "forbidden")
    }

    const gradeRepository = new GradeRepository(this.c)

    const grade = await gradeRepository.findById(command.gradeId)

    if (grade instanceof Error) {
      return new UnexpectedError("failed to find grade", { cause: grade })
    }

    if (grade === null) {
      return new NotFoundError("grade not found", "grade_not_found")
    }

    const repository = new EmployeeGradeRepository(this.c)

    const employeeGrade = EmployeeGrade.create({
      employeeId: command.employeeId,
      gradeId: command.gradeId,
      effectiveDate: command.effectiveDate,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    const created = await repository.create(employeeGrade)

    if (created instanceof UniqueConstraintError) {
      return new ConflictError(
        "employee grade for this date already exists",
        "employee_grade_conflict",
      )
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create employee grade", { cause: created })
    }

    return created
  }
}
