import type { Employee } from "@/domain/employee/employee"
import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment"
import type { OnboardingTask } from "@/domain/onboarding/onboarding-task"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  employeeCode: string
  templateCode: string
  assignedAt: string
}

export type EmployeeNotFound = { reason: "employee_not_found" }

export type TemplateNotFound = { reason: "template_not_found" }

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

  async run(
    command: Command,
  ): Promise<AssignOnboardingResult | EmployeeNotFound | TemplateNotFound | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const templateRepository = new OnboardingTemplateRepository(this.c)

    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    const employee = await employeeRepository.findByCode(command.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    const template = await templateRepository.findByCode(command.templateCode)

    if (template instanceof Error) {
      return template
    }

    if (template === null) {
      return { reason: "template_not_found" }
    }

    const assignment = OnboardingAssignment.create({
      employeeId: employee.id,
      template,
      assignedAt: command.assignedAt,
    })

    const created = await assignmentRepository.create(assignment)

    if (created instanceof Error) {
      return created
    }

    return { assignment: created, employee, template, tasks: created.tasks }
  }
}
