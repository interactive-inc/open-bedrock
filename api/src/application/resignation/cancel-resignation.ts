import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"

export type Command = {
  resignationId: string
  employeeId: number
}

export type ResignationNotFound = { reason: "resignation_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type Cancelled = { reason: "cancelled" }

/**
 * 退職申請を取消する。本人以外の取消を拒否する。
 */
export class CancelResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ResignationNotFound | NotApplicant | Error> {
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

    const deleted = await resignationRepository.delete(command.resignationId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
