import type { Resignation } from "@/domain/resignation/resignation"
import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"

export type Command = {
  employeeId: number
}

/**
 * 申請者本人の退職申請を一覧する。
 */
export class ListMyResignations {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<Resignation> | Error> {
    const resignationRepository = new ResignationRepository(this.c)

    return await resignationRepository.findByEmployeeId(command.employeeId)
  }
}
