import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  requesterId: number
  limit: number
  offset: number
}

/**
 * 申請者本人の反社チェック申請を一覧する。
 */
export class ListMyAntisocialChecks {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<AntisocialCheck> | ApplicationError> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const antisocialChecks = await antisocialCheckRepository.findByRequesterId({
      requesterId: command.requesterId,
      limit: command.limit,
      offset: command.offset,
    })

    if (antisocialChecks instanceof Error) {
      return new UnexpectedError("failed to find antisocial checks", { cause: antisocialChecks })
    }

    return antisocialChecks
  }
}
