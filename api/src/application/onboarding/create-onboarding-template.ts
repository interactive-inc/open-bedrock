import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: Session
  code: string
  name: string
  kind: "join" | "leave"
  description: string | null
}

/**
 * 管理権限を持つ者が新しいオンボーディングテンプレートを作成する。
 */
export class CreateOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OnboardingTemplate | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)

    if (command.session.hasPermission("onboarding:manage") === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const existing = await templateRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find template", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("template code already exists", "template_code_conflict")
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
      return new ConflictError("template code already exists", "template_code_conflict")
    }

    if (result instanceof Error) {
      return new UnexpectedError("failed to create template", { cause: result })
    }

    return result
  }
}
