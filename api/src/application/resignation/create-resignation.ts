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

export type AlreadyRequested = { kind: "already_requested" }

/**
 * 退職申請を作成する。status は "requested" で登録する。
 * 同一社員の PENDING（requested）申請が既に存在する場合は重複として拒否する。
 */
export class CreateResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | AlreadyRequested | Error> {
    const resignationRepository = new ResignationRepository(this.c)

    const existing = await resignationRepository.findPendingByEmployeeId(command.employeeId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { kind: "already_requested" }
    }

    const resignation = Resignation.create({
      employeeId: command.employeeId,
      resignationDate: command.resignationDate,
      lastWorkingDate: command.lastWorkingDate,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    const created = await resignationRepository.create(resignation)

    if (created instanceof Error) return created
    if ("kind" in created) return created

    return created
  }
}
