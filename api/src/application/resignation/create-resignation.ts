import { Resignation } from "@/domain/resignation/resignation"
import type { Context } from "@/env"
import { ResignationRepository } from "@/infrastructure/resignation/resignation-repository"

export type Command = {
  employeeId: number
  resignationDate: string
  lastWorkingDate: string | null
  reason: string | null
  createdAt: string
}

/**
 * 退職申請を作成する。status は "requested" で登録する。
 */
export class CreateResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | Error> {
    const resignationRepository = new ResignationRepository(this.c)

    const resignation = Resignation.create({
      employeeId: command.employeeId,
      resignationDate: command.resignationDate,
      lastWorkingDate: command.lastWorkingDate,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    return await resignationRepository.create(resignation)
  }
}
