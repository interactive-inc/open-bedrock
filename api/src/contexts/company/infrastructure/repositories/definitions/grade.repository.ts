import { GradeEntity } from "@/contexts/company/domain/entities/grade.entity"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { grades } from "@/contexts/company/infrastructure/schema/grade"
import { asc, count } from "drizzle-orm"

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
}
