import { CareerSheet } from "@/domain/career/career-sheet"
import type { Context } from "@/env"
import { careerSheets } from "@/schema"

export class CareerSheetRepository {
  constructor(private readonly c: Context) {}

  async upsert(careerSheet: CareerSheet): Promise<CareerSheet | Error> {
    try {
      const rows = await this.c.var.database
        .insert(careerSheets)
        .values({
          employeeId: careerSheet.employeeId,
          goalsText: careerSheet.goalsText,
          strengthsText: careerSheet.strengthsText,
          updatedAt: careerSheet.updatedAt,
        })
        .onConflictDoUpdate({
          target: careerSheets.employeeId,
          set: {
            goalsText: careerSheet.goalsText,
            strengthsText: careerSheet.strengthsText,
            updatedAt: careerSheet.updatedAt,
          },
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("career_sheets upsert returned no row")
        : CareerSheet.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to upsert career_sheet")
    }
  }
}
