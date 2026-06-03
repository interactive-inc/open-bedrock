import { canManageOnboarding } from "@/domain/onboarding/can-manage-onboarding"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type Forbidden = { reason: "forbidden" }

export type TemplateNotFound = { reason: "template_not_found" }

/**
 * 管理権限を持つ者がオンボーディングテンプレートを1件取得する。
 */
export class GetOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTemplate | Forbidden | TemplateNotFound | Error> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (canManageOnboarding(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const template = await templateRepository.findByCode(command.code)

    if (template instanceof Error) {
      return template
    }

    if (template === null) {
      return { reason: "template_not_found" }
    }

    return template
  }
}
