import type { Session } from "@/lib/auth/session"
import { RecruitmentCandidate } from "@/contexts/recruitment/domain/entities/recruitment-candidate.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RecruitmentRepository } from "@/contexts/recruitment/infrastructure/recruitment.repository"

export type Command = {
  session: Session
  id: number
  name: string
  email: string | null
  source: string | null
  note: string | null
}

/**
 * 権限と存在を確認し、応募者の名前・連絡先・流入元・備考を差し替える。ステージは advance で扱う。
 */
export class UpdateCandidate {
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

    const next = existing.withDetails({
      name: command.name,
      email: command.email,
      source: command.source,
      note: command.note,
    })

    const updated = await repository.updateCandidate(command.id, next)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update recruitment candidate", { cause: updated })
    }

    return updated
  }
}
