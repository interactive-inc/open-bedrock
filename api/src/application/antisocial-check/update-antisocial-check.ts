import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import { canManageAntisocialChecks } from "@/domain/antisocial-check/can-manage-antisocial-checks"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"

export type Command = {
  antisocialCheckId: string
  requesterId: number
  viewerRole: string
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  result: string | null
}

export type AntisocialCheckNotFound = { reason: "antisocial_check_not_found" }

export type NotRequester = { reason: "not_requester" }

export type NotModifiable = { reason: "not_modifiable" }

export type ResultForbidden = { reason: "result_forbidden" }

/**
 * 反社チェック申請の取引先情報と判定結果を変更する。本人以外と、確定済み申請の変更を拒否する。
 * result フィールドの設定・変更は管理者ロール（manager/hr/admin）限定。
 */
export class UpdateAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | AntisocialCheck
    | AntisocialCheckNotFound
    | NotRequester
    | NotModifiable
    | ResultForbidden
    | Error
  > {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const current = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "antisocial_check_not_found" }
    }

    if (current.requesterId !== command.requesterId) {
      return { reason: "not_requester" }
    }

    if (current.status !== "requested") {
      return { reason: "not_modifiable" }
    }

    // result フィールドを変更しようとしている場合は管理者ロールが必要。
    const isResultChanged = command.result !== current.result

    if (isResultChanged && !canManageAntisocialChecks(command.viewerRole)) {
      return { reason: "result_forbidden" }
    }

    const updated = current.withDetails({
      partnerName: command.partnerName,
      partnerAddress: command.partnerAddress,
      representativeName: command.representativeName,
      result: canManageAntisocialChecks(command.viewerRole) ? command.result : current.result,
    })

    const result = await antisocialCheckRepository.update(updated)

    if (result instanceof Error) {
      return result
    }

    if (result === null) {
      return { reason: "not_modifiable" }
    }

    return result
  }
}
