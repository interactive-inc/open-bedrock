import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"

export type Command = {
  antisocialCheckId: string
  requesterId: number
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  result: string | null
}

export type AntisocialCheckNotFound = { reason: "antisocial_check_not_found" }

export type NotRequester = { reason: "not_requester" }

/**
 * 反社チェック申請の取引先情報と判定結果を変更する。本人以外の変更を拒否する。
 */
export class UpdateAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<AntisocialCheck | AntisocialCheckNotFound | NotRequester | Error> {
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

    const updated = current.withDetails({
      partnerName: command.partnerName,
      partnerAddress: command.partnerAddress,
      representativeName: command.representativeName,
      result: command.result,
    })

    return await antisocialCheckRepository.update(updated)
  }
}
