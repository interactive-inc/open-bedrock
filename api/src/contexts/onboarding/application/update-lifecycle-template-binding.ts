import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template-repository"
import {
  ApplicationError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"

export class UpdateLifecycleTemplateBinding {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: Session
    templateCode: string
    effectType: "hire" | "retired"
  }): Promise<{ effectType: "hire" | "retired"; templateCode: string } | ApplicationError> {
    if (!command.session.hasPermission("onboarding:manage")) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }
    const template = await new OnboardingTemplateRepository(this.c).findByCode(command.templateCode)
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
    try {
      const saved = await this.c.env.DB.prepare(
        `INSERT INTO lifecycle_effect_template_bindings
           (effect_type, template_code, updated_at, updated_by_account_id)
         SELECT ?1, ?2, ?3, ?4
         FROM onboarding_templates
         WHERE code = ?2 AND kind = ?5
         ON CONFLICT(effect_type) DO UPDATE SET
           template_code = excluded.template_code,
           updated_at = excluded.updated_at,
           updated_by_account_id = excluded.updated_by_account_id
         RETURNING effect_type`,
      )
        .bind(
          command.effectType,
          command.templateCode,
          now,
          command.session.accountId,
          expectedKind,
        )
        .first<string>("effect_type")
      if (saved === null) {
        return new ValidationError(
          "the onboarding template changed before the lifecycle binding was saved",
          "invalid_template_kind",
        )
      }
      return { effectType: command.effectType, templateCode: command.templateCode }
    } catch (cause) {
      return new UnexpectedError("failed to update lifecycle template binding", { cause })
    }
  }
}
