import { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  requesterEmployeeId: number
  targetEmployeeCode: string
  date: string
  note: string | null
}

export type TargetNotFound = { reason: "target_not_found" }

/**
 * 交代相手を確認して、本人からのシフト交代申請を作る。
 */
export class CreateShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftSwapRequest | TargetNotFound | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const target = await employeeRepository.findByCode(input.targetEmployeeCode)

    if (target instanceof Error) {
      return target
    }

    if (target === null) {
      return { reason: "target_not_found" }
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const swapRequest = ShiftSwapRequest.create({
      requesterEmployeeId: input.requesterEmployeeId,
      targetEmployeeId: target.id,
      date: input.date,
      note: input.note,
    })

    return swapRequestRepository.create(swapRequest)
  }
}
