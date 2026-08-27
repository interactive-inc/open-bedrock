import type {
  EvaluationTemplate,
  EvaluationTemplateItem,
} from "@/contexts/performance-review/domain/entities/evaluation-template.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationTemplateRepository } from "@/contexts/performance-review/infrastructure/repositories/evaluation-template/evaluation-template.repository"

export type Command = {
  templateId: number
  title: string
  period: string
  items: ReadonlyArray<EvaluationTemplateItem>
  now: string
}

export class UpdateEvaluationTemplate {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<EvaluationTemplate | ApplicationError> {
    const repository = new EvaluationTemplateRepository(this.c)

    const existing = await repository.findById(command.templateId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load evaluation template", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("evaluation template not found", "evaluation_template_not_found")
    }

    // テンプレートの編集は draft のみ許可
    if (existing.status !== "draft") {
      return new ConflictError(
        `cannot edit template in ${existing.status} status; only draft templates can be modified`,
        "template_not_editable",
      )
    }

    const updated = existing.withDetails({
      title: command.title,
      period: command.period,
      items: command.items,
      now: command.now,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update evaluation template", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("evaluation template not found", "evaluation_template_not_found")
    }

    return saved
  }
}
