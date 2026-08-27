import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CareerSheet } from "@/contexts/career/domain/entities/career-sheet.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CareerSheetRepository } from "@/contexts/career/infrastructure/repositories/career-sheet.repository"

export type Command = {
  employeeId: EmployeeId
  goalsText: string | null
  strengthsText: string | null
  now: string
}

/**
 * 本人のキャリアシートを upsert する。
 */
export class UpdateMyCareerSheet {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<CareerSheet | ApplicationError> {
    const repository = new CareerSheetRepository(this.c)

    const updated = await repository.upsert(
      CareerSheet.create({
        employeeId: command.employeeId,
        goalsText: command.goalsText,
        strengthsText: command.strengthsText,
        updatedAt: command.now,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update career sheet", { cause: updated })
    }

    return updated
  }
}
