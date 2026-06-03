import { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  employeeId: number
  leaveKind: string
  startDate: string
  endDate: string
  note: string | null
  createdAt: string
}

/**
 * 休業申出を作成する。status は "requested" で登録する。
 */
export class CreateFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<FamilyCareLeave | Error> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const familyCareLeave = FamilyCareLeave.create({
      employeeId: command.employeeId,
      leaveKind: command.leaveKind,
      startDate: command.startDate,
      endDate: command.endDate,
      note: command.note,
      createdAt: command.createdAt,
    })

    return await familyCareLeaveRepository.create(familyCareLeave)
  }
}
