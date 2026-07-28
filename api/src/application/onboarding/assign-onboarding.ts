import type { Session } from "@/lib/auth/session"
import type { Employee } from "@/domain/employee/employee.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import type { OnboardingTask } from "@/domain/onboarding/onboarding-task.entity"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: Session
  employeeCode: string
  templateCode: string
  assignedAt: string
}

export type AssignOnboardingResult = {
  assignment: OnboardingAssignment
  employee: Employee
  template: OnboardingTemplate
  tasks: ReadonlyArray<OnboardingTask>
}

/**
 * テンプレートを社員に割り当て、タスクを展開して関連エンティティを返す。
 */
export class AssignOnboarding {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AssignOnboardingResult | ApplicationError> {
    if (command.session.hasPermission("onboarding:manage") === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const templateRepository = new OnboardingTemplateRepository(this.c)

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const employee = await employeeRepository.findByCode(command.employeeCode)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    const template = await templateRepository.findByCode(command.templateCode)

    if (template instanceof Error) {
      return new UnexpectedError("failed to find template", { cause: template })
    }

    if (template === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    const existing = await assignmentRepository.findActiveByEmployeeAndTemplate(
      employee.id,
      template.code,
    )

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("template already assigned", "already_assigned")
    }

    const assignment = OnboardingAssignment.create({
      employeeId: employee.id,
      template,
      assignedAt: command.assignedAt,
    })

    const created = await assignmentRepository.create(assignment)

    // TOCTOU: findActiveByEmployeeAndTemplate で未検出でも並行リクエストが
    // 先に INSERT した場合、UNIQUE 制約違反で UniqueConstraintError になる。
    if (created instanceof UniqueConstraintError) {
      return new ConflictError("template already assigned", "already_assigned")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create assignment", { cause: created })
    }

    return { assignment: created, employee, template, tasks: created.tasks }
  }
}
