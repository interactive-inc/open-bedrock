import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Decision } from "@/domain/decision/decision.entity"
import type { Context } from "@/env"
import { DecisionRepository } from "@/infrastructure/decision/decision-repository"

export type Command = {
  session: Session
  decisionId: number
  title: string
  decidedOn: string
  context: string
  decision: string
  consequences: string | null
}

/**
 * 権限を確認し、意思決定記録の内容を更新する。
 */
export class UpdateDecision {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Decision | ApplicationError> {
    const decisionRepository = new DecisionRepository(this.c)

    if (command.session.hasPermission("decision:manage") === false) {
      return new ForbiddenError("cannot manage decisions", "forbidden")
    }

    const current = await decisionRepository.findById(command.decisionId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find decision", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("decision not found", "decision_not_found")
    }

    const updated = await decisionRepository.update(
      current.withContent({
        title: command.title,
        decidedOn: command.decidedOn,
        context: command.context,
        decision: command.decision,
        consequences: command.consequences,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update decision", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("decision not found", "decision_not_found")
    }

    return updated
  }
}
