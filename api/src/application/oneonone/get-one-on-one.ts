import type { OneOnOne } from "@/domain/oneonone/one-on-one"
import type { Context } from "@/env"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"

export type Command = {
  oneOnOneId: string
  viewerId: number
}

export type OneOnOneNotFound = { reason: "one_on_one_not_found" }

export type NotParticipant = { reason: "not_participant" }

/**
 * 1on1 を1件取得する。参加者（メンバー or マネージャー）以外の閲覧を拒否する。
 */
export class GetOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OneOnOne | OneOnOneNotFound | NotParticipant | Error> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const oneOnOne = await oneOnOneRepository.findById(command.oneOnOneId)

    if (oneOnOne instanceof Error) {
      return oneOnOne
    }

    if (oneOnOne === null) {
      return { reason: "one_on_one_not_found" }
    }

    const isParticipant =
      oneOnOne.memberId === command.viewerId || oneOnOne.managerId === command.viewerId

    if (isParticipant === false) {
      return { reason: "not_participant" }
    }

    return oneOnOne
  }
}
