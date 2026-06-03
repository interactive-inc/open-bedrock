import { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"

export type Command = {
  requesterId: number
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  createdAt: string
}

/**
 * 反社チェック申請を作成する。status は "requested" で登録する。
 */
export class CreateAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AntisocialCheck | Error> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const antisocialCheck = AntisocialCheck.create({
      requesterId: command.requesterId,
      partnerName: command.partnerName,
      partnerAddress: command.partnerAddress,
      representativeName: command.representativeName,
      createdAt: command.createdAt,
    })

    return await antisocialCheckRepository.create(antisocialCheck)
  }
}
