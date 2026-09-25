import type { CompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import type { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"

type Context = Readonly<{
  assignmentRepository: Pick<OnboardingAssignmentRepository, "findById" | "update">
  employeeDirectory: Pick<CompanyEmployeeDirectory, "findById">
}>

export type Command = {
  assignmentId: string
  session: CompanySessionValue
  assignedAt: string
}

export type UpdateOnboardingAssignmentResult = {
  assignment: OnboardingAssignment
  employee: CompanyEmployeeDirectoryEntry
}

/**
 * 割り当ての割当日を変更する。特権ロールのみ許可する。
 */
export class UpdateOnboardingAssignment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<UpdateOnboardingAssignmentResult | ApplicationError> {
    if (command.session.hasPermission("onboarding:manage") === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const current = await this.c.assignmentRepository.findById(command.assignmentId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    if (current.status !== "in_progress") {
      return new ConflictError("assignment is not modifiable", "not_modifiable")
    }

    const updated = await this.c.assignmentRepository.update(
      current.withRescheduled(command.assignedAt),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update assignment", { cause: updated })
    }

    const employee = await this.c.employeeDirectory.findById(updated.employeeId)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    return { assignment: updated, employee }
  }
}
