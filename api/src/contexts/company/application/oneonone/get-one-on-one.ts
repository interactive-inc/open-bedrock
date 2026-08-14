import type { OneOnOne } from "@/contexts/company/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { OneOnOneRepository } from "@/contexts/company/infrastructure/oneonone/one-on-one-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  oneOnOneId: string
  viewerId: number
}

/**
 * 1on1 を1件取得する。参加者（メンバー or マネージャー）以外の閲覧を拒否する。
 */
export class GetOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OneOnOne | ApplicationError> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const oneOnOne = await oneOnOneRepository.findById(command.oneOnOneId)

    if (oneOnOne instanceof Error) {
      return new UnexpectedError("failed to find one-on-one", { cause: oneOnOne })
    }

    if (oneOnOne === null) {
      return new NotFoundError("one-on-one not found", "one_on_one_not_found")
    }

    const isParticipant =
      oneOnOne.memberId === command.viewerId || oneOnOne.managerId === command.viewerId

    if (isParticipant === false) {
      return new ForbiddenError("not a participant", "not_participant")
    }

    return oneOnOne
  }
}
