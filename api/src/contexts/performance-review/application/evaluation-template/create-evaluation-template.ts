import {
  EvaluationTemplate,
  type EvaluationTemplateItem,
} from "@/contexts/performance-review/domain/entities/evaluation-template.entity"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationTemplateRepository } from "@/contexts/performance-review/infrastructure/evaluation-template/evaluation-template.repository"

export type Command = {
  title: string
  period: string
  items: ReadonlyArray<EvaluationTemplateItem>
  createdBy: number
  now: string
}

export class CreateEvaluationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EvaluationTemplate | ApplicationError> {
    const repository = new EvaluationTemplateRepository(this.c)

    const template = EvaluationTemplate.create({
      title: command.title,
      period: command.period,
      items: command.items,
      createdBy: command.createdBy,
      now: command.now,
    })

    const created = await repository.create(template)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create evaluation template", { cause: created })
    }

    return created
  }
}
