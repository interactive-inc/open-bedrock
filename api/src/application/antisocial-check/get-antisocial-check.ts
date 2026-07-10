import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import type { Context } from "@/env"
import type { SessionPayload } from "@/env"
import { canManageAntisocialChecks } from "@/lib/antisocial-check/can-manage-antisocial-checks"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  antisocialCheckId: string
  session: SessionPayload
}

/**
 * 反社チェック申請を1件取得する。本人または管理権限保持者だけが閲覧できる。
 */
export class GetAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AntisocialCheck | ApplicationError> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const antisocialCheck = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (antisocialCheck instanceof Error) {
      return new UnexpectedError("failed to find antisocial check", { cause: antisocialCheck })
    }

    if (antisocialCheck === null) {
      return new NotFoundError("antisocial check not found", "antisocial_check_not_found")
    }

    if (
      antisocialCheck.requesterId !== command.session.employeeId &&
      canManageAntisocialChecks(command.session) === false
    ) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    return antisocialCheck
  }
}
