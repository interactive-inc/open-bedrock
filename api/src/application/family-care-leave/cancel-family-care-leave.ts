import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  familyCareLeaveId: string
  employeeId: number
}

export type FamilyCareLeaveNotFound = { reason: "family_care_leave_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 休業申出を取消する。本人以外と、承認済み申出の取消を拒否する。
 */
export class CancelFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | FamilyCareLeaveNotFound | NotApplicant | NotModifiable | Error> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const current = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "family_care_leave_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    if (current.status !== "requested") {
      return { reason: "not_modifiable" }
    }

    const deleted = await familyCareLeaveRepository.delete(command.familyCareLeaveId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
