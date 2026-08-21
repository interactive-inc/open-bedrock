import { Grade } from "@/contexts/administration/domain/entities/grade.entity"
import type { Context } from "@/env"
import { grades } from "@/contexts/company/infrastructure/schema/grade"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"
import { asc, eq } from "drizzle-orm"

export class GradeRepository {
  constructor(private readonly c: Context) {}

  /** 等級マスタを rank の昇順で返す。 */
  async findAll(props: { limit: number; offset: number }): Promise<ReadonlyArray<Grade> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(grades)
        .orderBy(asc(grades.rank))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Grade.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load grades")
    }
  }

  async count(): Promise<number | Error> {
    try {
      const rows = await this.c.var.database.select().from(grades)

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count grades")
    }
  }

  async findById(gradeId: number): Promise<Grade | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(grades)
        .where(eq(grades.id, gradeId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Grade.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load grade")
    }
  }

  async create(grade: Grade): Promise<Grade | Error> {
    try {
      const rows = await this.c.var.database
        .insert(grades)
        .values({
          code: grade.code,
          name: grade.name,
          rank: grade.rank,
          description: grade.description,
          createdAt: grade.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to create grade") : Grade.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("grade code already exists", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to create grade")
    }
  }

  async update(grade: Grade): Promise<Grade | null | Error> {
    try {
      if (grade.id === null) {
        return new Error("cannot update unsaved grade")
      }

      const rows = await this.c.var.database
        .update(grades)
        .set({
          code: grade.code,
          name: grade.name,
          rank: grade.rank,
          description: grade.description,
        })
        .where(eq(grades.id, grade.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Grade.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("grade code already exists", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to update grade")
    }
  }

  async delete(gradeId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(grades).where(eq(grades.id, gradeId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete grade")
    }
  }
}
