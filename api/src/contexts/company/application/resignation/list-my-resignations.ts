import type { Resignation } from "@/contexts/company/domain/resignation/resignation.entity"
import type { Context } from "@/env"
import { ResignationRepository } from "@/contexts/company/infrastructure/resignation/resignation-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  employeeId: number
  limit: number
  offset: number
}

/**
 * 申請者本人の退職申請を一覧する。
 */
export class ListMyResignations {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<Resignation> | ApplicationError> {
    const resignationRepository = new ResignationRepository(this.c)

    const resignations = await resignationRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })

    if (resignations instanceof Error) {
      return new UnexpectedError("failed to find resignations", { cause: resignations })
    }

    return resignations
  }
}
