import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { Employee } from "@/contexts/company-compatibility/domain/employee/employee.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingAssignment } from "@/contexts/onboarding/domain/onboarding-assignment.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company-compatibility/infrastructure/employee/employee-repository"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  session: Session
  assignedAt: string
}

export type UpdateOnboardingAssignmentResult = {
  assignment: OnboardingAssignment
  employee: Employee
}

/**
 * 割り当ての割当日を変更する。特権ロールのみ許可する。
 */
export class UpdateOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<UpdateOnboardingAssignmentResult | ApplicationError> {
    if (command.session.hasPermission("onboarding:manage") === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(command.assignmentId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    if (current.status === "completed") {
      return new ConflictError("assignment is not modifiable", "not_modifiable")
    }

    const updated = await assignmentRepository.update(current.withRescheduled(command.assignedAt))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update assignment", { cause: updated })
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findById(updated.employeeId)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    return { assignment: updated, employee }
  }
}
