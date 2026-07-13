import type { Context } from "@/env"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { dueAt } from "@/lib/application/evaluate-workflow"

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

    const step = instance.definition.steps.find((item) => item.key === instance.currentStepKey)
    if (step === undefined) {
      return new UnexpectedError("workflow current step is invalid")
    }

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE applications
             SET payload = ?2, current_step = ?3
             WHERE id = ?1 AND applicant_id = ?4 AND status = 'pending' AND current_step = ?5`,
        ).bind(
          command.applicationId,
          JSON.stringify(command.payload),
          instance.currentStepKey,
          command.applicantId,
          `returned:${instance.currentStepKey}`,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `UPDATE application_workflow_instances
             SET current_round = current_round + 1, started_at = ?2, due_at = ?3
             WHERE application_id = ?1 AND current_step_key = ?4 AND current_round = ?5`,
        ).bind(
          command.applicationId,
          command.resubmittedAt,
          dueAt(command.resubmittedAt, step.due_days),
          instance.currentStepKey,
          instance.currentRound,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])

      return {
        id: command.applicationId,
        status: "pending",
        currentStep: instance.currentStepKey,
        payload: command.payload,
      }
    } catch (error) {
      return isAbortedByGuard(error)
        ? new ConflictError("application changed while resubmitting", "not_returned")
        : new UnexpectedError("failed to resubmit application", { cause: error })
    }
  }
}
