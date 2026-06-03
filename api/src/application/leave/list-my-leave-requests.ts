import type { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  employeeId: number
}

/**
 * 申請者本人の休暇申請を一覧する。
 */
export class ListMyLeaveRequests {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<LeaveRequest> | Error> {
    const repository = new LeaveRequestRepository(this.c)

    return await repository.findByEmployeeId(command.employeeId)
  }
}
