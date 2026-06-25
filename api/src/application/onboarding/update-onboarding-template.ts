import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  viewerRole: string
  code: string
  name: string
  kind: "join" | "leave"
  description: string | null
}

/**
 * 管理権限を持つ者がオンボーディングテンプレートの名称・種別・説明を変更する。code と tasks は変更しない。
 */
export class UpdateOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTemplate | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

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

    const updated = await templateRepository.update(
      current.withDetails({
        name: command.name,
        kind: command.kind,
        description: command.description,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update template", { cause: updated })
    }

    return updated
  }
}
