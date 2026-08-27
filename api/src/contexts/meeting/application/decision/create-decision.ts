import type { Session } from "@/lib/auth/session"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { Decision } from "@/contexts/meeting/domain/entities/decision.entity"
import type { Context } from "@/env"
import { DecisionRepository } from "@/contexts/meeting/infrastructure/repositories/decision/decision.repository"

export type Command = {
  session: Session
  title: string
  decidedOn: string
  context: string
  decision: string
  consequences: string | null
  createdAt: string
}

/**
 * 権限を確認し、意思決定記録を新規作成する。
 */
export class CreateDecision {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Decision | ApplicationError> {
    const decisionRepository = new DecisionRepository(this.c)

    if (command.session.hasPermission("decision:manage") === false) {
      return new ForbiddenError("cannot manage decisions", "forbidden")
    }

    const decision = Decision.create({
      title: command.title,
      decidedOn: command.decidedOn,
      context: command.context,
      decision: command.decision,
      consequences: command.consequences,
      createdAt: command.createdAt,
    })

    const created = await decisionRepository.create(decision)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create decision", { cause: created })
    }

    return created
  }
}
