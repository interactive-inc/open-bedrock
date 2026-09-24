import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import type { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import type { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"

type Context = Readonly<{
  templateRepository: Pick<OnboardingTemplateRepository, "findByCode" | "delete">
  assignmentRepository: Pick<OnboardingAssignmentRepository, "countActiveByTemplateCode">
}>

export type Command = {
  session: CompanySessionValue
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者がオンボーディングテンプレートを削除する。紐づくタスク定義も合わせて削除する。
 */
export class DeleteOnboardingTemplate {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Deleted | ApplicationError> {
    if (command.session.hasPermission("onboarding:manage") === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const current = await this.c.templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find template", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    const activeCount = await this.c.assignmentRepository.countActiveByTemplateCode(command.code)

    if (activeCount instanceof Error) {
      return new UnexpectedError("failed to count assignments", { cause: activeCount })
    }

    if (activeCount > 0) {
      return new ConflictError("template is in use", "template_in_use")
    }

    const deleted = await this.c.templateRepository.delete(current satisfies OnboardingTemplate)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete template", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("template is in use", "template_in_use")
    }

    return { reason: "deleted" }
  }
}
