import { ShiftPattern } from "@/domain/shift/shift-pattern.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { shiftPatterns } from "@/schema"
import { eq, sql } from "drizzle-orm"

export class ShiftPatternRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<ShiftPattern | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftPatterns)
        .where(eq(shiftPatterns.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ShiftPattern.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_pattern")
    }
  }

  async findById(patternId: number): Promise<ShiftPattern | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftPatterns)
        .where(eq(shiftPatterns.id, patternId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ShiftPattern.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_pattern")
    }
  }

  async create(pattern: ShiftPattern): Promise<ShiftPattern | Error> {
    try {
      const rows = await this.c.var.database
        .insert(shiftPatterns)
        .values({
          code: pattern.code,
          name: pattern.name,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          breakMinutes: pattern.breakMinutes,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert shift pattern")
        : ShiftPattern.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("shift pattern already exists", { cause: error })
      }
      return error instanceof Error ? error : new Error("failed to insert shift pattern")
    }
  }

  async update(pattern: ShiftPattern): Promise<ShiftPattern | null | Error> {
    try {
      if (pattern.id === null) {
        return new Error("cannot update unsaved shift pattern")
      }

      const rows = await this.c.var.database
        .update(shiftPatterns)
        .set({
          code: pattern.code,
          name: pattern.name,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          breakMinutes: pattern.breakMinutes,
        })
        .where(eq(shiftPatterns.id, pattern.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ShiftPattern.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update shift pattern")
    }
  }

  /**
   * 割当から参照されていない場合のみ削除する。チェックと削除を atomic に行い、
   * 競合状態でアサインが挿入されても参照整合性を壊さない。
   * 0 行削除（アサインが存在した等）は null、1 行以上削除は true を返す。
   */
  async delete(patternId: number): Promise<true | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`DELETE FROM shift_patterns
            WHERE id = ${patternId}
            AND NOT EXISTS (
              SELECT 1 FROM shift_assignments WHERE pattern_id = ${patternId}
            )`,
      )

      return result.meta.changes === 0 ? null : true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete shift pattern")
    }
  }
}
