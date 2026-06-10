import type { OneOnOne } from "@/domain/oneonone/one-on-one"
import type { Context } from "@/env"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"

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

  async run(command: Command): Promise<ReadonlyArray<OneOnOne> | Error> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    return await oneOnOneRepository.findByParticipantId(command.employeeId, {
      limit: command.limit,
      offset: command.offset,
    })
  }
}
