import type { EvaluationTemplate } from "@/contexts/performance-review/domain/entities/evaluation-template.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationTemplateRepository } from "@/contexts/performance-review/infrastructure/repositories/evaluation-template/evaluation-template.repository"

export type Command = {
  templateId: number
  now: string
}

/** 評価テンプレートをアーカイブする。 */
export class ArchiveEvaluationTemplate {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<EvaluationTemplate | ApplicationError> {
    const repository = new EvaluationTemplateRepository(this.c)

    const existing = await repository.findById(command.templateId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load evaluation template", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("evaluation template not found", "evaluation_template_not_found")
    }

    const updated = existing.withStatus("archived", command.now)

    if (updated === null) {
      return new ConflictError(
        `cannot transition from ${existing.status} to ${"archived"}`,
        "invalid_status_transition",
      )
    }

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update evaluation template status", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("evaluation template not found", "evaluation_template_not_found")
    }

    return saved
  }
}
