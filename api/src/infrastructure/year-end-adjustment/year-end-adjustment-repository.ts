import { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import type { Context } from "@/env"
import { yearEndAdjustments } from "@/schema"
import { and, desc, eq } from "drizzle-orm"

export class YearEndAdjustmentRepository {
  constructor(private readonly c: Context) {}

  // 本人の年末調整申告を対象年の降順で返す。
  // 本人の年末調整申告を対象年の降順でページングして返す。
  async findByEmployeeId(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<YearEndAdjustment> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(yearEndAdjustments)
        .where(eq(yearEndAdjustments.employeeId, props.employeeId))
        .orderBy(desc(yearEndAdjustments.targetYear))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => YearEndAdjustment.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load year_end_adjustments")
    }
  }

  // 年末調整申告 id で1件取得する。存在しなければ null。
  async findById(id: string): Promise<YearEndAdjustment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(yearEndAdjustments)
        .where(eq(yearEndAdjustments.id, id))

      const row = rows.at(0)

      return row === undefined ? null : YearEndAdjustment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load year_end_adjustment")
    }
  }

  // 同一社員・同一年度の申告が存在するか確認する。
  async findByEmployeeIdAndYear(
    employeeId: number,
    targetYear: number,
  ): Promise<YearEndAdjustment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(yearEndAdjustments)
        .where(
          and(
            eq(yearEndAdjustments.employeeId, employeeId),
            eq(yearEndAdjustments.targetYear, targetYear),
          ),
        )
      const row = rows.at(0)
      return row === undefined ? null : YearEndAdjustment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find year_end_adjustment")
    }
  }

  async create(yearEndAdjustment: YearEndAdjustment): Promise<YearEndAdjustment | Error> {
    try {
      await this.c.var.database.insert(yearEndAdjustments).values({
        id: yearEndAdjustment.id,
        employeeId: yearEndAdjustment.employeeId,
        targetYear: yearEndAdjustment.targetYear,
        note: yearEndAdjustment.note,
        status: yearEndAdjustment.status,
        createdAt: yearEndAdjustment.createdAt,
      })

      return yearEndAdjustment
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save year_end_adjustment")
    }
  }

  // 年末調整申告の対象年・備考を更新する。
  async update(yearEndAdjustment: YearEndAdjustment): Promise<YearEndAdjustment | Error> {
    try {
      await this.c.var.database
        .update(yearEndAdjustments)
        .set({
          targetYear: yearEndAdjustment.targetYear,
          note: yearEndAdjustment.note,
        })
        .where(eq(yearEndAdjustments.id, yearEndAdjustment.id))

      return yearEndAdjustment
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update year_end_adjustment")
    }
  }

  // 年末調整申告を削除する。
  async delete(id: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(yearEndAdjustments).where(eq(yearEndAdjustments.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete year_end_adjustment")
    }
  }
}
