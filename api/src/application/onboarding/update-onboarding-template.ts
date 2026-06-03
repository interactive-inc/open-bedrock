import { canManageOnboarding } from "@/domain/onboarding/can-manage-onboarding"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  viewerRole: string
  code: string
  name: string
  kind: "join" | "leave"
  description: string | null
}

export type Forbidden = { reason: "forbidden" }

export type TemplateNotFound = { reason: "template_not_found" }

export type UpdateFailure = Forbidden | TemplateNotFound

/**
 * 管理権限を持つ者がオンボーディングテンプレートの名称・種別・説明を変更する。code と tasks は変更しない。
 */
export class UpdateOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTemplate | UpdateFailure | Error> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (canManageOnboarding(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const current = await templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "template_not_found" }
    }

    return templateRepository.update(
      current.withDetails({
        name: command.name,
        kind: command.kind,
        description: command.description,
      }),
    )
  }
}
