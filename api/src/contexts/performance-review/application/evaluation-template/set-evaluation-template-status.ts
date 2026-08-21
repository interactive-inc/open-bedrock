import type {
  EvaluationTemplate,
  EvaluationTemplateStatus,
} from "@/contexts/performance-review/domain/evaluation-template/evaluation-template.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationTemplateRepository } from "@/contexts/performance-review/infrastructure/evaluation-template/evaluation-template.repository"

export type Command = {
  templateId: number
  status: EvaluationTemplateStatus
  now: string
}

export class SetEvaluationTemplateStatus {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EvaluationTemplate | ApplicationError> {
    const repository = new EvaluationTemplateRepository(this.c)

    const existing = await repository.findById(command.templateId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load evaluation template", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("evaluation template not found", "evaluation_template_not_found")
    }

    const updated = existing.withStatus(command.status, command.now)

    if (updated === null) {
      return new ConflictError(
        `cannot transition from ${existing.status} to ${command.status}`,
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
