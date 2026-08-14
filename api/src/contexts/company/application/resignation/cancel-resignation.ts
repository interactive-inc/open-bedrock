import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  resignationId: string
  employeeId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 退職申請を取消する。本人以外と、承認済み申請の取消を拒否する。
 */
export class CancelResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
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

    const deleted = await resignationRepository.delete(command.resignationId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete resignation", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("resignation is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
