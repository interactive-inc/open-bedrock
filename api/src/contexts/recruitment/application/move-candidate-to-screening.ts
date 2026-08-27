import type { Session } from "@/lib/auth/session"
import { RecruitmentCandidate } from "@/contexts/recruitment/domain/entities/recruitment-candidate.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RecruitmentRepository } from "@/contexts/recruitment/infrastructure/repositories/recruitment.repository"

export type Command = {
  session: Session
  id: number
}

/** 応募者を書類選考へ進める。 */
export class MoveCandidateToScreening {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<RecruitmentCandidate | ApplicationError> {
    if (command.session.hasPermission("recruitment:manage") === false) {
      return new ForbiddenError("cannot manage recruitment", "forbidden")
    }

    const repository = new RecruitmentRepository(this.c)

    const existing = await repository.findCandidateById(command.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find recruitment candidate", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("recruitment candidate not found", "recruitment_candidate_not_found")
    }

    if (existing.canAdvanceTo("screening") === false) {
      return new ConflictError(
        `cannot advance candidate from ${existing.stage} to ${"screening"}`,
        "recruitment_stage_transition_invalid",
      )
    }

    const updated = await repository.updateCandidate(command.id, existing.withStage("screening"))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to advance recruitment candidate", { cause: updated })
    }

    return updated
  }
}
