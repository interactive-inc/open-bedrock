import { canManageOnboarding } from "@/domain/onboarding/can-manage-onboarding"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type Forbidden = { reason: "forbidden" }

export type TemplateNotFound = { reason: "template_not_found" }

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者がオンボーディングテンプレートを削除する。紐づくタスク定義も合わせて削除する。
 */
export class DeleteOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | Forbidden | TemplateNotFound | Error> {
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

    const deleted = await templateRepository.delete(command.code)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
