import type {
  EvaluationTemplate,
  EvaluationTemplateItem,
} from "@/domain/evaluation-template/evaluation-template.entity"
import type { Context } from "@/env"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationTemplateRepository } from "@/infrastructure/evaluation-template/evaluation-template-repository"

export type Command = {
  templateId: number
  title: string
  period: string
  items: ReadonlyArray<EvaluationTemplateItem>
  now: string
}

export class UpdateEvaluationTemplate {
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
