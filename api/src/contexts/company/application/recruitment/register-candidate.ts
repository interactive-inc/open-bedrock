import type { Session } from "@/contexts/company/domain/iam/session"
import { RecruitmentCandidate } from "@/contexts/company/domain/recruitment/recruitment-candidate.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RecruitmentRepository } from "@/contexts/company/infrastructure/recruitment/recruitment-repository"

export type Command = {
  session: Session
  positionId: number
  name: string
  email: string | null
  source: string | null
  note: string | null
  createdAt: string
}

/**
 * 権限と募集の存在を確認し、応募者を applied ステージで1件登録する。
 */
export class RegisterCandidate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RecruitmentCandidate | ApplicationError> {
    if (command.session.hasPermission("recruitment:manage") === false) {
      return new ForbiddenError("cannot manage recruitment", "forbidden")
    }

    const repository = new RecruitmentRepository(this.c)

    const position = await repository.findPositionById(command.positionId)

    if (position instanceof Error) {
      return new UnexpectedError("failed to find recruitment position", { cause: position })
    }

    if (position === null) {
      return new NotFoundError("recruitment position not found", "recruitment_position_not_found")
    }

    const candidate = RecruitmentCandidate.create({
      positionId: command.positionId,
      name: command.name,
      email: command.email,
      source: command.source,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.createCandidate(candidate)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create recruitment candidate", { cause: created })
    }

    return created
  }
}
