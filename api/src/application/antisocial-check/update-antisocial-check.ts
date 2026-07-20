import type { Session } from "@/lib/auth/session"
import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  antisocialCheckId: string
  session: Session
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  result: string | null
}

/**
 * 本人は未確定の取引先情報だけ、管理権限保持者は他者の判定結果だけを変更できる。
 * 自分の申請を自分で判定することと、確定済み申請の再変更を拒否する。
 */
export class UpdateAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AntisocialCheck | ApplicationError> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const current = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find antisocial check", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("antisocial check not found", "antisocial_check_not_found")
    }

    const isOwner = current.requesterId === command.session.employeeId

    const canManage = command.session.hasPermission("antisocial_check:manage")

    if (isOwner === false && canManage === false) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    const isResultChanged = command.result !== current.result

    if (isResultChanged && (canManage === false || isOwner)) {
      return new ForbiddenError("cannot decide this antisocial check", "result_forbidden")
    }

    const isDetailsChanged =
      command.partnerName !== current.partnerName ||
      command.partnerAddress !== current.partnerAddress ||
      command.representativeName !== current.representativeName

    if (isOwner === false && isDetailsChanged) {
      return new ForbiddenError("only the requester can change details", "details_forbidden")
    }

    const updated = current.withDetails({
      partnerName: isOwner ? command.partnerName : current.partnerName,
      partnerAddress: isOwner ? command.partnerAddress : current.partnerAddress,
      representativeName: isOwner ? command.representativeName : current.representativeName,
      result: canManage && isOwner === false ? command.result : current.result,
    })

    const result = await antisocialCheckRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update antisocial check", { cause: result })
    }

    if (result === null) {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    return result
  }
}
