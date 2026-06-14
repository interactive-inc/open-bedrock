import type { Resignation } from "@/domain/resignation/resignation.entity"
import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"

export type Command = {
  resignationId: string
  employeeId: number
}

export type ResignationNotFound = { reason: "resignation_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * 退職申請を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | ResignationNotFound | NotApplicant | Error> {
    const resignationRepository = new ResignationRepository(this.c)

    const resignation = await resignationRepository.findById(command.resignationId)

    if (resignation instanceof Error) {
      return resignation
    }

    if (resignation === null) {
      return { reason: "resignation_not_found" }
    }

    if (resignation.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    return resignation
  }
}
