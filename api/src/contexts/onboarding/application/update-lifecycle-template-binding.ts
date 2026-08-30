import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"
import {
  ApplicationError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"

export class UpdateLifecycleTemplateBinding {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: {
    session: CompanySessionValue
    templateCode: string
    effectType: "hire" | "retired"
  }): Promise<{ effectType: "hire" | "retired"; templateCode: string } | ApplicationError> {
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
      return new NotFoundError("template not found", "template_not_found")
    }
    const expectedKind = command.effectType === "hire" ? "join" : "leave"
    if (template.kind !== expectedKind) {
      return new ValidationError(
        `the ${command.effectType} effect requires a ${expectedKind} template`,
        "invalid_template_kind",
      )
    }
    const now = Math.floor(Date.parse(this.c.env.NOW ?? new Date().toISOString()) / 1_000)
    const saved = await repository.saveLifecycleBinding({
      effectType: command.effectType,
      template,
      updatedAt: now,
      updatedByAccountId: command.session.accountId,
    })
    if (saved instanceof Error) {
      return new UnexpectedError("failed to update lifecycle template binding", { cause: saved })
    }
    if (saved === false) {
      return new ValidationError(
        "the onboarding template changed before the lifecycle binding was saved",
        "invalid_template_kind",
      )
    }

    return { effectType: command.effectType, templateCode: command.templateCode }
  }
}
