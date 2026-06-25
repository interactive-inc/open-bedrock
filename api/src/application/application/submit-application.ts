import { Application } from "@/domain/application/application.entity"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  applicantId: number
  templateCode: string
  payload: unknown
  createdAt: string
}

export type SubmittedApplication = {
  id: number | null
  templateCode: string
  templateName: string
  applicantName: string
  status: "pending" | "approved" | "rejected"
  currentStep: string | null
  payload: unknown
  createdAt: string
}

/**
 * テンプレートを引いて申請を作成し、詳細を返す。
 */
export class SubmitApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SubmittedApplication | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const templateRepository = new ApplicationTemplateRepository(this.c)

    const employeeRepository = new EmployeeRepository(this.c)

    const template = await templateRepository.findByCode(command.templateCode)

    if (template instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: template })
    }

    if (template === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    if (template.id === null) {
      return new UnexpectedError("template id is not assigned")
    }

    const created = await applicationRepository.create(
      Application.create({
        templateId: template.id,
        applicantId: command.applicantId,
        currentStep: "manager_approval",
        payload: command.payload,
        createdAt: command.createdAt,
      }),
    )

    if (created instanceof Error) {
      return new UnexpectedError("failed to create application", { cause: created })
    }

    const applicant = await employeeRepository.findById(created.applicantId)

    if (applicant instanceof Error) {
      return new UnexpectedError("failed to find applicant", { cause: applicant })
    }

    return {
      id: created.id,
      templateCode: template.code,
      templateName: template.name,
      applicantName: applicant?.name ?? "",
      status: created.status,
      currentStep: created.currentStep,
      payload: created.payload,
      createdAt: created.createdAt,
    }
  }
}
