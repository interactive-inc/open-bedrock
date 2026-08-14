import { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/infrastructure/antisocial-check/antisocial-check-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

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

  async run(command: Command): Promise<AntisocialCheck | ApplicationError> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const antisocialCheck = AntisocialCheck.create({
      requesterId: command.requesterId,
      partnerName: command.partnerName,
      partnerAddress: command.partnerAddress,
      representativeName: command.representativeName,
      createdAt: command.createdAt,
    })

    const created = await antisocialCheckRepository.create(antisocialCheck)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create antisocial check", { cause: created })
    }

    return created
  }
}
