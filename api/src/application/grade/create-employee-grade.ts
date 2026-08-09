import type { Session } from "@/domain/company/iam/session"
import { EmployeeGrade } from "@/domain/grade/employee-grade.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { EmployeeGradeRepository } from "@/infrastructure/grade/employee-grade-repository"
import { GradeRepository } from "@/infrastructure/grade/grade-repository"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: Session
  employeeId: number
  gradeId: number
  effectiveDate: string
  reason: string | null
  createdAt: string
  reviewCycleId: number | null
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

    if (command.reviewCycleId !== null) {
      const cycle = await new ReviewCycleRepository(this.c).findById(command.reviewCycleId)

      if (cycle instanceof Error) {
        return new UnexpectedError("failed to find review cycle", { cause: cycle })
      }

      if (cycle === null) {
        return new NotFoundError("review cycle not found", "review_cycle_not_found")
      }
    }

    const repository = new EmployeeGradeRepository(this.c)

    const employeeGrade = EmployeeGrade.create({
      employeeId: command.employeeId,
      gradeId: command.gradeId,
      effectiveDate: command.effectiveDate,
      reason: command.reason,
      createdAt: command.createdAt,
      reviewCycleId: command.reviewCycleId,
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
