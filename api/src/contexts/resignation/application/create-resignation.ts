import { Resignation } from "@/contexts/resignation/domain/resignation.entity"
import type { Context } from "@/env"
import { ResignationRepository } from "@/contexts/resignation/infrastructure/resignation-repository"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  employeeId: number
  resignationDate: string
  lastWorkingDate: string | null
  reason: string | null
  createdAt: string
}

/**
 * 退職申請を作成する。status は "requested" で登録する。
 * 同一社員の PENDING（requested）申請が既に存在する場合は重複として拒否する。
 */
export class CreateResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | ApplicationError> {
    const resignationRepository = new ResignationRepository(this.c)

    const existing = await resignationRepository.findPendingByEmployeeId(command.employeeId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find resignation", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("a pending resignation already exists", "already_requested")
    }

    const resignation = Resignation.create({
      employeeId: command.employeeId,
      resignationDate: command.resignationDate,
      lastWorkingDate: command.lastWorkingDate,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    const created = await resignationRepository.create(resignation)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create resignation", { cause: created })
    }

    if ("kind" in created) {
      return new ConflictError("a pending resignation already exists", "already_requested")
    }

    return created
  }
}
