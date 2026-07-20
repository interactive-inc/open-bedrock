import type { Session } from "@/lib/auth/session"
import { RecruitmentPosition } from "@/domain/recruitment/recruitment-position.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RecruitmentRepository } from "@/infrastructure/recruitment/recruitment-repository"

export type Command = {
  session: Session
  title: string
  departmentCode: string | null
  status: "open" | "closed"
  note: string | null
  createdAt: string
}

/**
 * 権限を確認し、募集ポジションを1件登録する。応募者は社外個人情報のため recruitment:manage に閉じる。
 */
export class RegisterPosition {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RecruitmentPosition | ApplicationError> {
    if (command.session.hasPermission("recruitment:manage") === false) {
      return new ForbiddenError("cannot manage recruitment", "forbidden")
    }

    const repository = new RecruitmentRepository(this.c)

    const position = RecruitmentPosition.create({
      title: command.title,
      departmentCode: command.departmentCode,
      status: command.status,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.createPosition(position)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create recruitment position", { cause: created })
    }

    return created
  }
}
