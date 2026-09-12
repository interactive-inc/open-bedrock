import { PositionEntity } from "@/contexts/company/domain/entities/position.entity"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { positions } from "@/contexts/company/infrastructure/schema/position"
import { asc, count } from "drizzle-orm"

type Context = CompanyContext

export class PositionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(input: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<PositionEntity> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(positions)
        .orderBy(asc(positions.rank), asc(positions.id))
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((row) => PositionEntity.restore(row))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company positions")
    }
  }

  async count(): Promise<number | Error> {
    try {
      return (await this.c.var.database.select({ total: count() }).from(positions))[0]?.total ?? 0
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company positions")
    }
  }
}
