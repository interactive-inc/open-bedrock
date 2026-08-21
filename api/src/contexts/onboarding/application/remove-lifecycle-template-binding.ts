import type { Session } from "@/lib/auth/session"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template.repository"
import { ApplicationError, ForbiddenError, UnexpectedError } from "@/lib/errors"

export class RemoveLifecycleTemplateBinding {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: Session
    templateCode: string
  }): Promise<{ removed: boolean } | ApplicationError> {
    if (!command.session.hasPermission("onboarding:manage")) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const removed = await new OnboardingTemplateRepository(this.c).removeLifecycleBinding(
      command.templateCode,
    )
    if (removed instanceof Error) {
      return new UnexpectedError("failed to remove lifecycle template binding", {
        cause: removed,
      })
    }

    return { removed }
  }
}
