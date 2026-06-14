import type { Employee } from "@/domain/employee/employee.entity"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import type { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  viewerRole: string
  assignedAt: string
}

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type NotModifiable = { reason: "not_modifiable" }

export type UpdateOnboardingAssignmentResult = {
  assignment: OnboardingAssignment
  employee: Employee
}

/**
 * 割り当ての割当日を変更する。特権ロールのみ許可する。
 */
export class UpdateOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    UpdateOnboardingAssignmentResult | AssignmentNotFound | Forbidden | NotModifiable | Error
  > {
    if (canManageOnboarding(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(command.assignmentId)

    if (current === null) {
      return { reason: "assignment_not_found" }
    }

    if (current instanceof Error) {
      return current
    }

    if (current.status === "completed") {
      return { reason: "not_modifiable" }
    }

    const updated = await assignmentRepository.update(current.withRescheduled(command.assignedAt))

    if (updated instanceof Error) {
      return updated
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findById(updated.employeeId)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "assignment_not_found" }
    }

    return { assignment: updated, employee }
  }
}
