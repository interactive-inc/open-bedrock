import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"

export type Command = {
  resignationId: string
  employeeId: number
}

export type ResignationNotFound = { reason: "resignation_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 退職申請を取消する。本人以外と、承認済み申請の取消を拒否する。
 */
export class CancelResignation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | ResignationNotFound | NotApplicant | NotModifiable | Error> {
    const resignationRepository = new ResignationRepository(this.c)

    const current = await resignationRepository.findById(command.resignationId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "resignation_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    if (!current.isModifiable) {
      return { reason: "not_modifiable" }
    }

    const deleted = await resignationRepository.delete(command.resignationId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
