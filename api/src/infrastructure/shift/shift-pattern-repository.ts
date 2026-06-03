import { ShiftPattern } from "@/domain/shift/shift-pattern"
import type { Context } from "@/env"
import { shiftPatterns } from "@/schema"
import { eq } from "drizzle-orm"

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

  async delete(patternId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(shiftPatterns).where(eq(shiftPatterns.id, patternId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete shift pattern")
    }
  }
}
