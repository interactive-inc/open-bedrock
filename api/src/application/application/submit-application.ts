import { Application } from "@/domain/application/application.entity"
import { NotFoundError, UnexpectedError, UnprocessableError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import { applicableWorkflowSteps, dueAt } from "@/lib/application/evaluate-workflow"
import { resolveWorkflowApproverIds } from "@/lib/application/resolve-workflow-approvers"

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

    if (configuredWorkflow !== null && created.id !== null) {
      const steps = applicableWorkflowSteps({
        workflow: configuredWorkflow,
        payload: command.payload,
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
        await applicationRepository.delete(created.id)
        return new UnexpectedError("application workflow has no applicable steps")
      }

      for (const step of steps) {
        const candidates = await resolveWorkflowApproverIds({
          c: this.c,
          applicantEmployeeId: command.applicantId,
          selectors: step.approvers,
        })
        if (candidates instanceof Error) {
          await applicationRepository.delete(created.id)
          return new UnexpectedError("failed to resolve workflow approvers", {
            cause: candidates,
          })
        }
        const required =
          step.approval_mode === "all"
            ? candidates.length
            : step.approval_mode === "minimum"
              ? (step.minimum_approvals ?? 1)
              : 1
        if (candidates.length === 0 || required > candidates.length) {
          await applicationRepository.delete(created.id)
          return new UnprocessableError(
            `workflow step has insufficient approvers: ${step.key}`,
            "workflow_unresolvable",
          )
        }
      }

      const snapshot = { ...configuredWorkflow, steps: [...steps] }
      const firstStep = steps[0]

      if (firstStep === undefined) {
        await applicationRepository.delete(created.id)
        return new UnexpectedError("application workflow has no first step")
      }

      const initialized = await workflowRepository.createInstance({
        applicationId: created.id,
        definition: snapshot,
        currentStepKey: firstStep.key,
        startedAt: command.createdAt,
        dueAt: dueAt(command.createdAt, firstStep.due_days),
      })

      if (initialized instanceof Error) {
        await applicationRepository.delete(created.id)
        return new UnexpectedError("failed to initialize application workflow", {
          cause: initialized,
        })
      }
    }

    return {
      id: created.id,
      templateCode: template.code,
      templateName: template.name,
      applicantName: applicant.name,
      status: created.status,
      currentStep:
        configuredWorkflow === null
          ? created.currentStep
          : (applicableWorkflowSteps({
              workflow: configuredWorkflow,
              payload: command.payload,
              applicant: {
                id: applicant.id,
                code: applicant.code,
                dept_id: applicant.deptId,
                dept_name: applicant.deptName,
                position: applicant.position,
                status: applicant.status,
              },
            }).at(0)?.key ?? created.currentStep),
      payload: created.payload,
      createdAt: created.createdAt,
      approverRoles: template.approverRoles,
    }
  }
}
