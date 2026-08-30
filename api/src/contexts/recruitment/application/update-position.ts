import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { RecruitmentPosition } from "@/contexts/recruitment/domain/entities/recruitment-position.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RecruitmentRepository } from "@/contexts/recruitment/infrastructure/repositories/recruitment.repository"

export type Command = {
  session: CompanySessionValue
  id: number
  title: string
  departmentCode: string | null
  status: "open" | "closed"
  note: string | null
}

/**
 * 権限と存在を確認し、募集ポジションの内容と状態を差し替える。
 */
export class UpdatePosition {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<RecruitmentPosition | ApplicationError> {
    if (command.session.hasPermission("recruitment:manage") === false) {
      return new ForbiddenError("cannot manage recruitment", "forbidden")
    }

    const repository = new RecruitmentRepository(this.c)

    const existing = await repository.findPositionById(command.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find recruitment position", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("recruitment position not found", "recruitment_position_not_found")
    }

    const next = existing.withDetails({
      title: command.title,
      departmentCode: command.departmentCode,
      status: command.status,
      note: command.note,
    })

    const updated = await repository.updatePosition(command.id, next)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update recruitment position", { cause: updated })
    }

    return updated
  }
}
