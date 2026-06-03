import type { Context } from "@/env"
import { CareerSheetRepository } from "@/infrastructure/career/career-sheet-repository"

export type Command = {
  employeeId: number
}

export type Cleared = { reason: "cleared" }

/**
 * 本人のキャリアシートを削除する。未登録でも成功として扱う。
 */
export class DeleteMyCareerSheet {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cleared | Error> {
    const repository = new CareerSheetRepository(this.c)

    const deleted = await repository.deleteByEmployeeId(command.employeeId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cleared" }
  }
}
