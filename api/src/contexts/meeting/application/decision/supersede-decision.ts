import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Decision } from "@/contexts/meeting/domain/decision/decision.entity"
import type { Context } from "@/env"
import { DecisionRepository } from "@/contexts/meeting/infrastructure/decision/decision-repository"

export type Command = {
  session: Session
  decisionId: number
  supersededById: number
}

/**
 * 権限を確認し、意思決定記録を後続の決定で supersede する。
 * active な決定だけを条件付き UPDATE で superseded に遷移させ、対象外なら 409。
 */
export class SupersedeDecision {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Decision | ApplicationError> {
    const decisionRepository = new DecisionRepository(this.c)

    if (command.session.hasPermission("decision:manage") === false) {
      return new ForbiddenError("cannot manage decisions", "forbidden")
    }

    if (command.decisionId === command.supersededById) {
      return new ConflictError("decision cannot supersede itself", "decision_self_supersede")
    }

    const target = await decisionRepository.findById(command.decisionId)

    if (target instanceof Error) {
      return new UnexpectedError("failed to find decision", { cause: target })
    }

    if (target === null) {
      return new NotFoundError("decision not found", "decision_not_found")
    }

    const successor = await decisionRepository.findById(command.supersededById)

    if (successor instanceof Error) {
      return new UnexpectedError("failed to find successor decision", { cause: successor })
    }

    if (successor === null) {
      return new NotFoundError("successor decision not found", "successor_not_found")
    }

    const superseded = await decisionRepository.supersede(
      command.decisionId,
      command.supersededById,
    )

    if (superseded instanceof Error) {
      return new UnexpectedError("failed to supersede decision", { cause: superseded })
    }

    if (superseded === null) {
      return new ConflictError("decision is not active", "decision_not_active")
    }

    return superseded
  }
}
