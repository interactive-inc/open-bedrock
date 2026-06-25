import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者がオンボーディングテンプレートを削除する。紐づくタスク定義も合わせて削除する。
 */
export class DeleteOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)
    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

    if (canManageOnboarding(command.viewerRole) === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const current = await templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find template", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    const activeCount = await assignmentRepository.countActiveByTemplateCode(command.code)

    if (activeCount instanceof Error) {
      return new UnexpectedError("failed to count assignments", { cause: activeCount })
    }

    if (activeCount > 0) {
      return new ConflictError("template is in use", "template_in_use")
    }

    const deleted = await templateRepository.delete(command.code)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete template", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("template is in use", "template_in_use")
    }

    return { reason: "deleted" }
  }
}
