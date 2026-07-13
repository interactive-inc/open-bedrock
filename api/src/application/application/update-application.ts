import type { Application } from "@/domain/application/application.entity"
import type { Context } from "@/env"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { validateAndNormalizeApplicationPayload } from "@/lib/application/validate-application-payload"

export type Command = {
  applicationId: number
  applicantId: number
  payload: unknown
}

/**
 * 申請内容を更新する。本人以外の変更と、審査済み（pending 以外）の変更を拒否する。
 */
export class UpdateApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Application | ApplicationError> {
    const applicationRepository = new ApplicationRepository(this.c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    if (current.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "pending") {
      return new ConflictError("application is already decided", "not_pending")
    }

    const workflow = await new ApplicationWorkflowRepository(this.c).findInstance(
      command.applicationId,
    )
    if (workflow instanceof Error) {
      return new UnexpectedError("failed to find workflow instance", { cause: workflow })
    }
    if (workflow !== null) {
      return new ConflictError(
        "workflow application can only be edited when resubmitting a return",
        "workflow_locked",
      )
    }

    const template = await new ApplicationTemplateRepository(this.c).findById(current.templateId)
    if (template instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: template })
    }
    if (template === null) {
      return new UnexpectedError("application template not found")
    }

    const payload = validateAndNormalizeApplicationPayload(template.schemaJson, command.payload)
    if (payload instanceof Error) {
      return new UnprocessableError("payload does not match template schema", "invalid_payload", {
        cause: payload,
      })
    }

    const updated = await applicationRepository.updatePayload(current.withPayload(payload))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update application", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("application is already decided", "not_pending")
    }

    return updated
  }
}
