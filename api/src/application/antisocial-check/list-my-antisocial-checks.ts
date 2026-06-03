import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"

export type Command = {
  requesterId: number
}

/**
 * 申請者本人の反社チェック申請を一覧する。
 */
export class ListMyAntisocialChecks {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<AntisocialCheck> | Error> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    return await antisocialCheckRepository.findByRequesterId(command.requesterId)
  }
}
