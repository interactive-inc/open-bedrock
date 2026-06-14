import { canManageShift } from "@/lib/shift/can-manage-shift"
import { ShiftAssignment } from "@/domain/shift/shift-assignment.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  employeeCode: string
  patternCode: string
  date: string
  note: string | null
}

export type Forbidden = { reason: "forbidden" }

export type EmployeeNotFound = { reason: "employee_not_found" }

export type PatternNotFound = { reason: "pattern_not_found" }

export type DuplicateAssignment = { reason: "duplicate_assignment" }

/**
 * 権限・社員・パターンを確認して下書きのシフト割当を作る。
 */
export class CreateShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<
    ShiftAssignment | Forbidden | EmployeeNotFound | PatternNotFound | DuplicateAssignment | Error
  > {
    if (canManageShift(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findByCode(input.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const pattern = await patternRepository.findByCode(input.patternCode)

    if (pattern instanceof Error) {
      return pattern
    }

    if (pattern === null) {
      return { reason: "pattern_not_found" }
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const existing = await assignmentRepository.findByEmployeeIdAndDate(employee.id, input.date)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "duplicate_assignment" }
    }

    const assignment = ShiftAssignment.create({
      employeeId: employee.id,
      patternId: pattern.id,
      date: input.date,
      note: input.note,
    })

    const result = await assignmentRepository.create(assignment)

    if (result instanceof UniqueConstraintError) {
      return { reason: "duplicate_assignment" }
    }

    return result
  }
}
