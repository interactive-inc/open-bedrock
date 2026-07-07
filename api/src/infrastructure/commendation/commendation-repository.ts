import { Commendation } from "@/domain/commendation/commendation.entity"
import type { Context } from "@/env"
import { commendations } from "@/schema"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class CommendationRepository {
  constructor(private readonly c: Context) {}

  async list(props: {
    employeeId: number | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Commendation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(commendations)
        .where(this.toConditions(props.employeeId))
        .orderBy(desc(commendations.awardedOn))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Commendation.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load commendations")
    }
  }

  async count(employeeId: number | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(commendations)
        .where(this.toConditions(employeeId))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count commendations")
    }
  }

  async create(commendation: Commendation): Promise<Commendation | Error> {
    try {
      const rows = await this.c.var.database
        .insert(commendations)
        .values({
          employeeId: commendation.employeeId,
          title: commendation.title,
          reason: commendation.reason,
          awardedOn: commendation.awardedOn,
          createdAt: commendation.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create commendation")
        : Commendation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create commendation")
    }
  }

  async delete(id: number): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .delete(commendations)
        .where(eq(commendations.id, id))
        .returning()

      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete commendation")
    }
  }

  private toConditions(employeeId: number | null): SQL | undefined {
    const conditions: Array<SQL> = []

    if (employeeId !== null) {
      conditions.push(eq(commendations.employeeId, employeeId))
    }

    return conditions.length === 0 ? undefined : and(...conditions)
  }
}
