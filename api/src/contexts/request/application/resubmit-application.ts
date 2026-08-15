import type { Context } from "@/env"
import { ApplicationRepository } from "@/contexts/request/infrastructure/application-repository"
import { ApplicationTemplateRepository } from "@/contexts/request/infrastructure/application-template-repository"
import { ApplicationWorkflowRepository } from "@/contexts/request/infrastructure/application-workflow-repository"
import { WorkflowSql } from "@/contexts/request/infrastructure/workflow-sql"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { resolveWorkflowStepSnapshot } from "@/contexts/request/application/workflow/resolve-workflow-step-snapshot"
import { UnresolvableWorkflowStepError } from "@/contexts/request/application/workflow/unresolvable-workflow-step-error"
import { applicableWorkflowSteps } from "@/contexts/request/application/workflow/applicable-workflow-steps"
import { validateAndNormalizeApplicationPayload } from "@/contexts/request/application/validate-application-payload"

export type ResubmittedApplication = {
  id: number
  status: "pending"
  currentStep: string
  payload: unknown
}

/** 差戻された申請を、監査履歴を残したまま次のラウンドとして再申請する。 */
export class ResubmitApplication {
  constructor(private readonly c: Context) {}

  async run(command: {
    applicationId: number
    applicantId: number
    payload: unknown
    resubmittedAt: string
  }): Promise<ResubmittedApplication | ApplicationError> {
    const application = await new ApplicationRepository(this.c).findById(command.applicationId)
    if (application instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: application })
    }
    if (application === null) {
      return new NotFoundError("application not found", "application_not_found")
    }
    if (application.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    const instance = await new ApplicationWorkflowRepository(this.c).findInstance(
      command.applicationId,
    )
    if (instance instanceof Error) {
      return new UnexpectedError("failed to find workflow instance", { cause: instance })
    }
    if (
      instance === null ||
      application.status !== "pending" ||
      application.currentStep !== `returned:${instance.currentStepKey}`
    ) {
      return new ConflictError("application is not returned", "not_returned")
    }

    const template = await new ApplicationTemplateRepository(this.c).findById(
      application.templateId,
    )
    if (template instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: template })
    }
    if (template === null) {
      return new UnexpectedError("application template not found")
    }
    if (template.systemBinding !== null) {
      return new ConflictError(
        "system application cannot be resubmitted",
        "system_template_requires_dedicated_route",
      )
    }

    const payload = validateAndNormalizeApplicationPayload(template.schemaJson, command.payload)
    if (payload instanceof Error) {
      return new UnprocessableError("payload does not match template schema", "invalid_payload", {
        cause: payload,
      })
    }

    const applicant = await new EmployeeRepository(this.c).findById(application.applicantId)
    if (applicant instanceof Error) {
      return new UnexpectedError("failed to find workflow applicant", { cause: applicant })
    }
    if (applicant === null) {
      return new UnexpectedError("workflow applicant not found")
    }

    const applicableSteps = applicableWorkflowSteps({
      workflow: instance.definition,
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
    const restartStep = applicableSteps[0]
    if (restartStep === undefined) {
      return new UnprocessableError(
        "application workflow has no applicable steps",
        "workflow_unresolvable",
      )
    }

    const nextRound = await new ApplicationWorkflowRepository(this.c).findNextStepRound(
      command.applicationId,
      restartStep.key,
    )
    if (nextRound instanceof Error) {
      return new UnexpectedError("failed to resolve workflow resubmission round", {
        cause: nextRound,
      })
    }

    const nextRoundSnapshot = await resolveWorkflowStepSnapshot({
      c: this.c,
      applicantEmployeeId: application.applicantId,
      step: restartStep,
      activatedAt: command.resubmittedAt,
    })

    if (nextRoundSnapshot instanceof Error) {
      return nextRoundSnapshot instanceof UnresolvableWorkflowStepError
        ? new ConflictError(nextRoundSnapshot.message, "workflow_unresolvable")
        : new UnexpectedError("failed to resolve workflow approvers", {
            cause: nextRoundSnapshot,
          })
    }

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE application_requests
             SET payload = ?2, current_step = ?3
             WHERE id = ?1 AND applicant_id = ?4 AND status = 'pending' AND current_step = ?5`,
        ).bind(
          command.applicationId,
          JSON.stringify(payload),
          restartStep.key,
          command.applicantId,
          `returned:${instance.currentStepKey}`,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...new WorkflowSql(this.c.env.DB).insert({
          applicationId: command.applicationId,
          stepKey: restartStep.key,
          round: nextRound,
          snapshot: nextRoundSnapshot,
        }),
        this.c.env.DB.prepare(
          `UPDATE application_workflow_instances
             SET current_step_key = ?2, current_round = ?3, started_at = ?4, due_at = ?5
             WHERE application_id = ?1 AND current_step_key = ?6 AND current_round = ?7
             RETURNING current_step_key`,
        ).bind(
          command.applicationId,
          restartStep.key,
          nextRound,
          command.resubmittedAt,
          nextRoundSnapshot.dueAt,
          instance.currentStepKey,
          instance.currentRound,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])

      return {
        id: command.applicationId,
        status: "pending",
        currentStep: restartStep.key,
        payload,
      }
    } catch (error) {
      return isAbortedByGuard(error)
        ? new ConflictError("application changed while resubmitting", "not_returned")
        : new UnexpectedError("failed to resubmit application", { cause: error })
    }
  }
}
