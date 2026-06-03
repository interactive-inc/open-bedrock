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

/**
 * 退職申請の退職希望日・最終出社日・理由を変更する。本人以外の変更を拒否する。
 */
export class UpdateResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | ResignationNotFound | NotApplicant | Error> {
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

    const updated = current.withDetails({
      resignationDate: command.resignationDate,
      lastWorkingDate: command.lastWorkingDate,
      reason: command.reason,
    })

    return await resignationRepository.update(updated)
  }
}
