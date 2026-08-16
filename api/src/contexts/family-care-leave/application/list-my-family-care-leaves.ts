import type { FamilyCareLeave } from "@/contexts/family-care-leave/domain/family-care-leave.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/family-care-leave-repository"

export type Command = {
  employeeId: number
  limit: number
  offset: number
}

/**
 * 申出者本人の休業申出を一覧する。
 */
export class ListMyFamilyCareLeaves {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<FamilyCareLeave> | ApplicationError> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const familyCareLeaves = await familyCareLeaveRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })

    if (familyCareLeaves instanceof Error) {
      return new UnexpectedError("failed to find family care leaves", { cause: familyCareLeaves })
    }

    return familyCareLeaves
  }
}
