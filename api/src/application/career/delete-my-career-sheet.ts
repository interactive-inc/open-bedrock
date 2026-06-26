import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
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

  async run(command: Command): Promise<Cleared | ApplicationError> {
    const repository = new CareerSheetRepository(this.c)

    const deleted = await repository.deleteByEmployeeId(command.employeeId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete career sheet", { cause: deleted })
    }

    return { reason: "cleared" }
  }
}
