import type { OneOnOne } from "@/contexts/one-on-one/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { OneOnOneRepository } from "@/contexts/one-on-one/infrastructure/oneonone/one-on-one-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  employeeId: number
  limit: number
  offset: number
}

/**
 * 本人が参加した 1on1（メンバー or マネージャー）を一覧する。
 */
export class ListMyOneOnOnes {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<OneOnOne> | ApplicationError> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const oneOnOnes = await oneOnOneRepository.findByParticipantId(command.employeeId, {
      limit: command.limit,
      offset: command.offset,
    })

    if (oneOnOnes instanceof Error) {
      return new UnexpectedError("failed to find one-on-ones", { cause: oneOnOnes })
    }

    return oneOnOnes
  }
}
