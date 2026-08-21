import type { Session } from "@/lib/auth/session"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template.repository"
import { lifecycleEffectTemplateBindings } from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import { eq } from "drizzle-orm"

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
  constructor(private readonly c: Context) {}

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

    if (current.kind !== command.kind) {
      try {
        const bindings = await this.c.var.database
          .select({ effectType: lifecycleEffectTemplateBindings.effectType })
          .from(lifecycleEffectTemplateBindings)
          .where(eq(lifecycleEffectTemplateBindings.templateCode, command.code))
          .limit(1)

        if (bindings.length > 0) {
          return new ValidationError(
            "cannot change the kind of a lifecycle-bound onboarding template",
            "lifecycle_binding_kind_conflict",
          )
        }
      } catch (cause) {
        return new UnexpectedError("failed to inspect lifecycle template binding", { cause })
      }
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
