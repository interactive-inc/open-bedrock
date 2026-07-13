import { Application } from "@/domain/application/application.entity"
import { NotFoundError, UnexpectedError, UnprocessableError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import { applicableWorkflowSteps } from "@/lib/application/evaluate-workflow"
import {
  resolveWorkflowStepSnapshot,
  UnresolvableWorkflowStepError,
} from "@/lib/application/resolve-workflow-step-snapshot"
import { validateAndNormalizeApplicationPayload } from "@/lib/application/validate-application-payload"

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
  approverRoles: ReadonlyArray<string>
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

    const payload = validateAndNormalizeApplicationPayload(template.schemaJson, command.payload)

    if (payload instanceof Error) {
      return new UnprocessableError("payload does not match template schema", "invalid_payload", {
        cause: payload,
      })
    }

    const applicant = await employeeRepository.findById(command.applicantId)

    if (applicant instanceof Error) {
      return new UnexpectedError("failed to find applicant", { cause: applicant })
    }

    if (applicant === null) {
      return new UnexpectedError("applicant not found")
    }

    const workflowRepository = new ApplicationWorkflowRepository(this.c)
    const configuredWorkflow = await workflowRepository.findDefinition(template.id)

    if (configuredWorkflow instanceof Error) {
      return new UnexpectedError("failed to load application workflow", {
        cause: configuredWorkflow,
      })
    }

    let created: Application | Error

    if (configuredWorkflow === null) {
      created = await applicationRepository.create(
        Application.create({
          templateId: template.id,
          applicantId: command.applicantId,
          currentStep: "manager_approval",
          payload,
          createdAt: command.createdAt,
        }),
      )
    } else {
      const steps = applicableWorkflowSteps({
        workflow: configuredWorkflow,
        payload,
        applicant: {
          id: applicant.id,
          code: applicant.code,
          dept_id: applicant.deptId,
          dept_name: applicant.deptName,
          position: applicant.position,
          status: applicant.status,
        },
      })

      if (steps.length === 0) {
        return new UnexpectedError("application workflow has no applicable steps")
      }

      const firstStep = steps[0]

      if (firstStep === undefined) {
        return new UnexpectedError("application workflow has no first step")
      }

      const firstStepSnapshot = await resolveWorkflowStepSnapshot({
        c: this.c,
        applicantEmployeeId: command.applicantId,
        step: firstStep,
        activatedAt: command.createdAt,
      })

      if (firstStepSnapshot instanceof Error) {
        return firstStepSnapshot instanceof UnresolvableWorkflowStepError
          ? new UnprocessableError(firstStepSnapshot.message, "workflow_unresolvable")
          : new UnexpectedError("failed to resolve workflow approvers", {
              cause: firstStepSnapshot,
            })
      }

      created = await workflowRepository.createApplicationWithInstance({
        application: Application.create({
          templateId: template.id,
          applicantId: command.applicantId,
          currentStep: firstStep.key,
          payload,
          createdAt: command.createdAt,
        }),
        definition: configuredWorkflow,
        currentStepKey: firstStep.key,
        startedAt: command.createdAt,
        dueAt: firstStepSnapshot.dueAt,
        stepSnapshot: firstStepSnapshot,
      })
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create application", { cause: created })
    }

    return {
      id: created.id,
      templateCode: template.code,
      templateName: template.name,
      applicantName: applicant.name,
      status: created.status,
      currentStep: created.currentStep,
      payload: created.payload,
      createdAt: created.createdAt,
      approverRoles: template.approverRoles,
    }
  }
}
