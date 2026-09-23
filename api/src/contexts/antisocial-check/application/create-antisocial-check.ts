import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { AntisocialCheck } from "@/contexts/antisocial-check/domain/entities/antisocial-check.entity"
import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/contexts/antisocial-check/infrastructure/repositories/antisocial-check.repository"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { isAntisocialCheckRecordSourceFrozenError } from "@/contexts/antisocial-check/infrastructure/repositories/lib/is-antisocial-check-record-source-frozen-error"

export type Command = {
  requesterId: EmployeeId
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  createdAt: string
}

/**
 * 反社チェック申請を作成する。status は "requested" で登録する。
 */
export class CreateAntisocialCheck {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
      if (isAntisocialCheckRecordSourceFrozenError(created)) {
        return new ConflictError("antisocial check writes are frozen", "record_source_frozen", {
          cause: created,
        })
      }
      return new UnexpectedError("failed to create antisocial check", { cause: created })
    }

    return created
  }
}
