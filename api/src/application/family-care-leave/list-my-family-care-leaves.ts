import type { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  employeeId: number
}

/**
 * 申出者本人の休業申出を一覧する。
 */
export class ListMyFamilyCareLeaves {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<FamilyCareLeave> | Error> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    return await familyCareLeaveRepository.findByEmployeeId(command.employeeId)
  }
}
