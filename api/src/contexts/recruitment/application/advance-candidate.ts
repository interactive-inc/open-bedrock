import type { Session } from "@/contexts/company/domain/iam/session"
import { RecruitmentCandidate } from "@/contexts/recruitment/domain/recruitment-candidate.entity"
import type { CandidateStage } from "@/contexts/recruitment/domain/recruitment-candidate.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RecruitmentRepository } from "@/contexts/recruitment/infrastructure/recruitment.repository"

export type Command = {
  session: Session
  id: number
  stage: CandidateStage
}

/**
 * 権限と存在を確認し、応募者の選考ステージを1つ前進（または不採用）させる。不正な遷移は 409。
 */
export class AdvanceCandidate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RecruitmentCandidate | ApplicationError> {
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

    if (existing.canAdvanceTo(command.stage) === false) {
      return new ConflictError(
        `cannot advance candidate from ${existing.stage} to ${command.stage}`,
        "recruitment_stage_transition_invalid",
      )
    }

    const updated = await repository.updateCandidate(command.id, existing.withStage(command.stage))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to advance recruitment candidate", { cause: updated })
    }

    return updated
  }
}
