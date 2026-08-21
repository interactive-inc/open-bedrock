import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/onboarding-assignment.repository"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template.repository"
import { lifecycleEffectTemplateBindings } from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import { eq } from "drizzle-orm"

export type Command = {
  session: Session
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者がオンボーディングテンプレートを削除する。紐づくタスク定義も合わせて削除する。
 */
export class DeleteOnboardingTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const templateRepository = new OnboardingTemplateRepository(this.c)
    const assignmentRepository = new OnboardingAssignmentRepository(this.c)

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

    const activeCount = await assignmentRepository.countActiveByTemplateCode(command.code)

    if (activeCount instanceof Error) {
      return new UnexpectedError("failed to count assignments", { cause: activeCount })
    }

    if (activeCount > 0) {
      return new ConflictError("template is in use", "template_in_use")
    }

    try {
      const bindings = await this.c.var.database
        .select({ effectType: lifecycleEffectTemplateBindings.effectType })
        .from(lifecycleEffectTemplateBindings)
        .where(eq(lifecycleEffectTemplateBindings.templateCode, command.code))
        .limit(1)

      if (bindings.length > 0) {
        return new ConflictError("template is in use", "template_in_use")
      }
    } catch (cause) {
      return new UnexpectedError("failed to inspect lifecycle template binding", { cause })
    }

    const deleted = await templateRepository.delete(command.code)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete template", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("template is in use", "template_in_use")
    }

    return { reason: "deleted" }
  }
}
