import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  viewerRole: string
  code: string
}

/**
 * 管理権限を持つ者がオンボーディングテンプレートを1件取得する。
 */
export class GetOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTemplate | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (canManageOnboarding(command.viewerRole) === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const template = await templateRepository.findByCode(command.code)

    if (template instanceof Error) {
      return new UnexpectedError("failed to find template", { cause: template })
    }

    if (template === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    return template
  }
}
