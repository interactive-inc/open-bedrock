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

export type SelfReference = { reason: "self_reference" }

export type AlreadyExists = { reason: "already_exists" }

/**
 * 交代相手を確認して、本人からのシフト交代申請を作る。
 */
export class CreateShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<ShiftSwapRequest | TargetNotFound | SelfReference | AlreadyExists | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const target = await employeeRepository.findByCode(input.targetEmployeeCode)

    if (target instanceof Error) {
      return target
    }

    if (target === null) {
      return { reason: "target_not_found" }
    }

    if (target.id === input.requesterEmployeeId) {
      return { reason: "target_not_found" }
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const pending = await swapRequestRepository.findPending(
      input.requesterEmployeeId,
      target.id,
      input.date,
    )

    if (pending instanceof Error) {
      return pending
    }

    if (pending !== null) {
      return { reason: "already_exists" }
    }

    const swapRequest = ShiftSwapRequest.create({
      requesterEmployeeId: input.requesterEmployeeId,
      targetEmployeeId: target.id,
      date: input.date,
      note: input.note,
    })

    if ("reason" in swapRequest) {
      return swapRequest
    }

    const created = await swapRequestRepository.create(swapRequest)

    if (created instanceof Error) return created
    if ("reason" in created) return created

    return created
  }
}
