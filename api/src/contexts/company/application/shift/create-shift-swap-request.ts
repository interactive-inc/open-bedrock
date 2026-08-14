import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ShiftSwapRequest } from "@/contexts/company/domain/shift/shift-swap-request.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { ShiftAssignmentRepository } from "@/contexts/company/infrastructure/shift/shift-assignment-repository"
import { ShiftSwapRequestRepository } from "@/contexts/company/infrastructure/shift/shift-swap-request-repository"

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

    // 承認可能な交代のみ受け付ける。双方が対象日に公開済みの割当を持たなければ承認時に必ず
    // 409 になるため、作成時点で拒否する。承認側と同じ assignment_not_found コードで揃える。
    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const requesterAssignment = await assignmentRepository.findByEmployeeIdAndDate(
      input.requesterEmployeeId,
      input.date,
    )

    if (requesterAssignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: requesterAssignment })
    }

    if (requesterAssignment === null || requesterAssignment.publishedAt === null) {
      return new ConflictError(
        "requester has no published shift assignment on the date",
        "assignment_not_found",
      )
    }

    const targetAssignment = await assignmentRepository.findByEmployeeIdAndDate(
      target.id,
      input.date,
    )

    if (targetAssignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: targetAssignment })
    }

    if (targetAssignment === null || targetAssignment.publishedAt === null) {
      return new ConflictError(
        "target has no published shift assignment on the date",
        "assignment_not_found",
      )
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
