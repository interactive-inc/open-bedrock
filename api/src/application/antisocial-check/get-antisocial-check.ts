import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"

export type Command = {
  antisocialCheckId: string
  requesterId: number
}

export type AntisocialCheckNotFound = { reason: "antisocial_check_not_found" }

export type NotRequester = { reason: "not_requester" }

/**
 * 反社チェック申請を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<AntisocialCheck | AntisocialCheckNotFound | NotRequester | Error> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const antisocialCheck = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (antisocialCheck instanceof Error) {
      return antisocialCheck
    }

    if (antisocialCheck === null) {
      return { reason: "antisocial_check_not_found" }
    }

    if (antisocialCheck.requesterId !== command.requesterId) {
      return { reason: "not_requester" }
    }

    return antisocialCheck
  }
}
