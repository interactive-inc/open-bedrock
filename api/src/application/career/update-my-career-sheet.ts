import { CareerSheet } from "@/domain/career/career-sheet"
import type { Context } from "@/env"
import { CareerSheetRepository } from "@/infrastructure/career/career-sheet-repository"

export type Command = {
  employeeId: number
  goalsText: string | null
  strengthsText: string | null
  now: string
}

/**
 * 本人のキャリアシートを upsert する。
 */
export class UpdateMyCareerSheet {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CareerSheet | Error> {
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
      return updated
    }

    return updated
  }
}
