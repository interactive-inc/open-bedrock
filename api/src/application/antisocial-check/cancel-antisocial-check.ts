import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"

export type Command = {
  antisocialCheckId: string
  requesterId: number
}

export type AntisocialCheckNotFound = { reason: "antisocial_check_not_found" }

export type NotRequester = { reason: "not_requester" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 反社チェック申請を取消する。本人以外と、確定済み申請の取消を拒否する。
 */
export class CancelAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | AntisocialCheckNotFound | NotRequester | NotModifiable | Error> {
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

    const deleted = await antisocialCheckRepository.delete(command.antisocialCheckId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_modifiable" }
    }

    return { reason: "cancelled" }
  }
}
