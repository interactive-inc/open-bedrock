import type { Resignation } from "@/contexts/company/domain/resignation/resignation.entity"
import type { Context } from "@/env"
import { ResignationRepository } from "@/contexts/company/infrastructure/resignation/resignation-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  resignationId: string
  employeeId: number
}

/**
 * 退職申請を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | ApplicationError> {
    const resignationRepository = new ResignationRepository(this.c)

    const resignation = await resignationRepository.findById(command.resignationId)

    if (resignation instanceof Error) {
      return new UnexpectedError("failed to find resignation", { cause: resignation })
    }

    if (resignation === null) {
      return new NotFoundError("resignation not found", "resignation_not_found")
    }

    if (resignation.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return resignation
  }
}
