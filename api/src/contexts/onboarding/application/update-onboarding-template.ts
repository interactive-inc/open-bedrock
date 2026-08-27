import type { Session } from "@/lib/auth/session"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"

export type Command = {
  session: Session
  code: string
  name: string
  kind: "join" | "leave"
  description: string | null
}

/**
 * 管理権限を持つ者がオンボーディングテンプレートの名称・種別・説明を変更する。code と tasks は変更しない。
 */
export class UpdateOnboardingTemplate {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<OnboardingTemplate | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (command.session.hasPermission("onboarding:manage") === false) {
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

    if (updated === null) {
      return new ValidationError(
        "cannot change the kind of a lifecycle-bound onboarding template",
        "lifecycle_binding_kind_conflict",
      )
    }

    return updated
  }
}
