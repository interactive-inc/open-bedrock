import type { Resignation } from "@/domain/resignation/resignation"
import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"

export type Command = {
  resignationId: string
  employeeId: number
  resignationDate: string
  lastWorkingDate: string | null
  reason: string | null
}

export type ResignationNotFound = { reason: "resignation_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

/**
 * 退職申請の退職希望日・最終出社日・理由を変更する。本人以外と、承認済み申請の変更を拒否する。
 */
export class UpdateResignation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Resignation | ResignationNotFound | NotApplicant | NotModifiable | Error> {
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

    const updated = current.withDetails({
      resignationDate: command.resignationDate,
      lastWorkingDate: command.lastWorkingDate,
      reason: command.reason,
    })

    const result = await resignationRepository.update(updated)

    if (result === null) {
      return { reason: "not_modifiable" }
    }

    return result
  }
}
