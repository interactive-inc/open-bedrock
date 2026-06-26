import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ShiftSwapRequest } from "@/domain/shift/shift-swap-request.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  requesterEmployeeId: number
  targetEmployeeCode: string
  date: string
  note: string | null
}

/**
 * 交代相手を確認して、本人からのシフト交代申請を作る。
 */
export class CreateShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftSwapRequest | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    const target = await employeeRepository.findByCode(input.targetEmployeeCode)

    if (target instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: target })
    }

    if (target === null) {
      return new NotFoundError("target employee not found", "target_not_found")
    }

    if (target.id === input.requesterEmployeeId) {
      return new ValidationError("cannot swap with yourself", "self_reference")
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const pending = await swapRequestRepository.findPending(
      input.requesterEmployeeId,
      target.id,
      input.date,
    )

    if (pending instanceof Error) {
      return new UnexpectedError("failed to find pending shift swap request", { cause: pending })
    }

    if (pending !== null) {
      return new ConflictError("pending shift swap request already exists", "already_exists")
    }

    const swapRequest = ShiftSwapRequest.create({
      requesterEmployeeId: input.requesterEmployeeId,
      targetEmployeeId: target.id,
      date: input.date,
      note: input.note,
    })

    if ("reason" in swapRequest) {
      return new ValidationError("cannot swap with yourself", "self_reference")
    }

    const created = await swapRequestRepository.create(swapRequest)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create shift swap request", { cause: created })
    }

    if (created === null) {
      return new ConflictError("pending shift swap request already exists", "already_exists")
    }

    return created
  }
}
