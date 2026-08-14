import type { Resignation } from "@/contexts/company/domain/resignation/resignation.entity"
import type { Context } from "@/env"
import { ResignationRepository } from "@/contexts/company/infrastructure/resignation/resignation-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  resignationId: string
  employeeId: number
  resignationDate: string
  lastWorkingDate: string | null
  reason: string | null
}

/**
 * 退職申請の退職希望日・最終出社日・理由を変更する。本人以外と、承認済み申請の変更を拒否する。
 */
export class UpdateResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | ApplicationError> {
    const resignationRepository = new ResignationRepository(this.c)

    const current = await resignationRepository.findById(command.resignationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find resignation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("resignation not found", "resignation_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (!current.isModifiable) {
      return new ConflictError("resignation is not modifiable", "not_modifiable")
    }

    const updated = current.withDetails({
      resignationDate: command.resignationDate,
      lastWorkingDate: command.lastWorkingDate,
      reason: command.reason,
    })

    const saved = await resignationRepository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update resignation", { cause: saved })
    }

    if (saved === null) {
      return new ConflictError("resignation is not modifiable", "not_modifiable")
    }

    return saved
  }
}
