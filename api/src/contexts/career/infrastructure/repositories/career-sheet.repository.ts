import { CareerSheet } from "@/contexts/career/domain/entities/career-sheet.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { careerSheets } from "@/contexts/career/infrastructure/schema/career"
import { eq } from "drizzle-orm"

export class CareerSheetRepository {
  constructor(private readonly c: Context) {}

  /** 社員のキャリアシートを削除する。未登録でもエラーにしない。 */
  async deleteByEmployeeId(employeeId: EmployeeId): Promise<null | Error> {
    try {
      await this.c.var.database.delete(careerSheets).where(eq(careerSheets.employeeId, employeeId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete career_sheet")
    }
  }

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
