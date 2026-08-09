import type { Session } from "@/domain/company/iam/session"
import { SalaryRevision } from "@/domain/salary-revision/salary-revision.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { SalaryRevisionRepository } from "@/infrastructure/salary-revision/salary-revision-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: Session
  employeeId: number
  effectiveDate: string
  previousBaseSalary: number
  newBaseSalary: number
  reason: string | null
  createdAt: string
}

/**
 * 権限（最機微のため salary_revision:manage のみ）と対象社員の存在を確認し、
 * 給与改定の事実記録を追加する。同一社員・同一適用日の重複は 409。
 */
export class CreateSalaryRevision {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SalaryRevision | ApplicationError> {
    if (command.session.hasPermission("salary_revision:manage") === false) {
      return new ForbiddenError("cannot manage salary revisions", "forbidden")
    }

    const employee = await new EmployeeRepository(this.c).findById(command.employeeId)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    const revision = SalaryRevision.create({
      employeeId: command.employeeId,
      effectiveDate: command.effectiveDate,
      previousBaseSalary: command.previousBaseSalary,
      newBaseSalary: command.newBaseSalary,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    const created = await new SalaryRevisionRepository(this.c).create(revision)

    if (created instanceof UniqueConstraintError) {
      return new ConflictError(
        "salary revision for this date already exists",
        "salary_revision_conflict",
      )
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create salary revision", { cause: created })
    }

    return created
  }
}
