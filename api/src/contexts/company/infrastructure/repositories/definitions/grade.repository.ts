import { GradeEntity } from "@/contexts/company/domain/entities/grade.entity"
import { CompanyUniqueConstraintError } from "@/contexts/company/domain/errors"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employeeGrades, grades } from "@/contexts/company/infrastructure/schema/grade"
import { isCompanyUniqueConstraintError } from "@/contexts/company/infrastructure/repositories/employee/lib/is-company-unique-constraint-error"
import { asc, count, eq } from "drizzle-orm"

type Context = CompanyContext

export class GradeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(input: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<GradeEntity> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(grades)
        .orderBy(asc(grades.rank), asc(grades.id))
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((row) => GradeEntity.restore(row))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company grades")
    }
  }

  async count(): Promise<number | Error> {
    try {
      return (await this.c.var.database.select({ total: count() }).from(grades))[0]?.total ?? 0
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company grades")
    }
  }

  async find(id: number): Promise<GradeEntity | null | Error> {
    try {
      const row = (
        await this.c.var.database.select().from(grades).where(eq(grades.id, id)).limit(1)
      )[0]
      return row === undefined ? null : GradeEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find Company grade")
    }
  }

  async countAssignments(id: number): Promise<number | Error> {
    try {
      return (
        (
          await this.c.var.database
            .select({ total: count() })
            .from(employeeGrades)
            .where(eq(employeeGrades.gradeId, id))
        )[0]?.total ?? 0
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company grade usage")
    }
  }

  async create(entity: GradeEntity): Promise<GradeEntity | Error> {
    try {
      const props = entity.toProps()
      const row = (
        await this.c.var.database
          .insert(grades)
          .values({
            code: props.code,
            name: props.name,
            rank: props.rank,
            description: props.description,
            createdAt: props.createdAt,
          })
          .returning()
      )[0]
      return row === undefined
        ? new Error("failed to create Company grade")
        : GradeEntity.restore(row)
    } catch (cause) {
      return isCompanyUniqueConstraintError(cause)
        ? new CompanyUniqueConstraintError("grade code already exists", { cause })
        : cause instanceof Error
          ? cause
          : new Error("failed to create Company grade")
    }
  }

  async update(entity: GradeEntity): Promise<GradeEntity | null | Error> {
    const props = entity.toProps()
    if (props.id === null) return new Error("cannot update an unsaved Company grade")
    try {
      const row = (
        await this.c.var.database
          .update(grades)
          .set({
            code: props.code,
            name: props.name,
            rank: props.rank,
            description: props.description,
          })
          .where(eq(grades.id, props.id))
          .returning()
      )[0]
      return row === undefined ? null : GradeEntity.restore(row)
    } catch (cause) {
      return isCompanyUniqueConstraintError(cause)
        ? new CompanyUniqueConstraintError("grade code already exists", { cause })
        : cause instanceof Error
          ? cause
          : new Error("failed to update Company grade")
    }
  }

  async delete(entity: GradeEntity): Promise<boolean | Error> {
    const id = entity.toProps().id
    if (id === null) return new Error("cannot delete an unsaved Company grade")
    try {
      return (
        (await this.c.var.database.delete(grades).where(eq(grades.id, id)).returning()).length === 1
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to delete Company grade")
    }
  }
}
