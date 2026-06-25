import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import { canManageAntisocialChecks } from "@/lib/antisocial-check/can-manage-antisocial-checks"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  antisocialCheckId: string
  requesterId: number
  viewerRole: string
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  result: string | null
}

/**
 * 反社チェック申請の取引先情報と判定結果を変更する。本人以外と、確定済み申請の変更を拒否する。
 * result フィールドの設定・変更は管理者ロール（manager/hr/admin）限定。
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

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    // result フィールドを変更しようとしている場合は管理者ロールが必要。
    const isResultChanged = command.result !== current.result

    if (isResultChanged && !canManageAntisocialChecks(command.viewerRole)) {
      return new ForbiddenError("only managers can set the result", "result_forbidden")
    }

    const updated = current.withDetails({
      partnerName: command.partnerName,
      partnerAddress: command.partnerAddress,
      representativeName: command.representativeName,
      result: canManageAntisocialChecks(command.viewerRole) ? command.result : current.result,
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
