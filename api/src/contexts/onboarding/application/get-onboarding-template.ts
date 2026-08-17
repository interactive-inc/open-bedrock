import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template-repository"

export type Command = {
  session: Session
  code: string
}

/**
 * 管理権限を持つ者がオンボーディングテンプレートを1件取得する。
 */
export class GetOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTemplate | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (command.session.hasPermission("onboarding:manage") === false) {
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
