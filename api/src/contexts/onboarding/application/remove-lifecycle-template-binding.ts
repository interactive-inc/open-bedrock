import type { Session } from "@/lib/auth/session"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"
import { ApplicationError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"

export class RemoveLifecycleTemplateBinding {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: {
    session: Session
    templateCode: string
  }): Promise<{ removed: boolean } | ApplicationError> {
    if (!command.session.hasPermission("onboarding:manage")) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const repository = new OnboardingTemplateRepository(this.c)
    const template: OnboardingTemplate | null | Error = await repository.findByCode(
      command.templateCode,
    )
    if (template instanceof Error) {
      return new UnexpectedError("failed to load onboarding template", { cause: template })
    }
    if (template === null) {
      return { removed: false }
    }

    const removed = await repository.removeLifecycleBinding(template)
    if (removed instanceof Error) {
      return new UnexpectedError("failed to remove lifecycle template binding", {
        cause: removed,
      })
    }

    return { removed }
  }
}
