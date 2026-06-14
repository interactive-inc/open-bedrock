import type { Employee } from "@/domain/employee/employee.entity"
import { canViewEmployeeOnboarding } from "@/lib/onboarding/can-view-employee-onboarding"
import type { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"

export type Command = {
  assignmentId: number
  viewerEmployeeId: number
  viewerRole: string
}

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type GetOnboardingAssignmentResult = {
  assignment: OnboardingAssignment
  employee: Employee
}

/**
 * 割り当てを1件取得する。本人か特権ロールのみ許可する。
 */
export class GetOnboardingAssignment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<GetOnboardingAssignmentResult | AssignmentNotFound | Forbidden | Error> {
    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const assignment = await assignmentRepository.findById(command.assignmentId)

    if (assignment === null) {
      return { reason: "assignment_not_found" }
    }

    if (assignment instanceof Error) {
      return assignment
    }

    const isOwner = assignment.employeeId === command.viewerEmployeeId

    if (
      isOwner === false &&
      canViewEmployeeOnboarding({ viewerRole: command.viewerRole }) === false
    ) {
      return { reason: "forbidden" }
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findById(assignment.employeeId)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "assignment_not_found" }
    }

    return { assignment, employee }
  }
}
