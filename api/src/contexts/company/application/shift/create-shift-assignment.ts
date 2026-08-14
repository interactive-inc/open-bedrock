import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ShiftAssignment } from "@/contexts/company/domain/shift/shift-assignment.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"
import { ShiftAssignmentRepository } from "@/contexts/company/infrastructure/shift/shift-assignment-repository"
import { ShiftPatternRepository } from "@/contexts/company/infrastructure/shift/shift-pattern-repository"

export type Input = {
  session: Session
  employeeCode: string
  patternCode: string
  date: string
  note: string | null
}

/**
 * 権限・社員・パターンを確認して下書きのシフト割当を作る。
 */
export class CreateShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftAssignment | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findByCode(input.employeeCode)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const pattern = await patternRepository.findByCode(input.patternCode)

    if (pattern instanceof Error) {
      return new UnexpectedError("failed to find shift pattern", { cause: pattern })
    }

    if (pattern === null) {
      return new NotFoundError("shift pattern not found", "pattern_not_found")
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const existing = await assignmentRepository.findByEmployeeIdAndDate(employee.id, input.date)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("shift assignment already exists", "duplicate_assignment")
    }

    const assignment = ShiftAssignment.create({
      employeeId: employee.id,
      patternId: pattern.id,
      date: input.date,
      note: input.note,
    })

    const result = await assignmentRepository.create(assignment)

    if (result instanceof UniqueConstraintError) {
      return new ConflictError("shift assignment already exists", "duplicate_assignment")
    }

    if (result instanceof Error) {
      return new UnexpectedError("failed to create shift assignment", { cause: result })
    }

    return result
  }
}
