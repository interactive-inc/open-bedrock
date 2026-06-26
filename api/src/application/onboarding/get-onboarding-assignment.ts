import type { Employee } from "@/domain/employee/employee.entity"
import { canViewEmployeeOnboarding } from "@/lib/onboarding/can-view-employee-onboarding"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import type { Context, SessionPayload } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  viewerEmployeeId: number
  session: SessionPayload
}

export type GetOnboardingAssignmentResult = {
  assignment: OnboardingAssignment
  employee: Employee
}

/**
 * 割り当てを1件取得する。本人か特権ロールのみ許可する。
 */
export class GetOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<GetOnboardingAssignmentResult | ApplicationError> {
    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const assignment = await assignmentRepository.findById(command.assignmentId)

    if (assignment instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: assignment })
    }

    if (assignment === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    const isOwner = assignment.employeeId === command.viewerEmployeeId

    if (isOwner === false && canViewEmployeeOnboarding(command.session) === false) {
      return new ForbiddenError("cannot view assignment", "forbidden")
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findById(assignment.employeeId)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    return { assignment, employee }
  }
}
