import { canManageOnboarding } from "@/domain/onboarding/can-manage-onboarding"
import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  viewerRole: string
  code: string
  name: string
  kind: "join" | "leave"
  description: string | null
}

export type Forbidden = { reason: "forbidden" }

export type TemplateCodeConflict = { reason: "template_code_conflict" }

/**
 * 管理権限を持つ者が新しいオンボーディングテンプレートを作成する。
 */
export class CreateOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<OnboardingTemplate | Forbidden | TemplateCodeConflict | Error> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (canManageOnboarding(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const existing = await templateRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "template_code_conflict" }
    }

    const template = OnboardingTemplate.create({
      code: command.code,
      name: command.name,
      kind: command.kind,
      description: command.description,
    })

    const result = await templateRepository.create(template)

    // TOCTOU: findByCode で未検出でも並行リクエストが先に INSERT した場合
    if (result instanceof UniqueConstraintError) {
      return { reason: "template_code_conflict" }
    }

    return result
  }
}
