import { HealthCheckup } from "@/domain/health-checkup/health-checkup.entity"
import type { Context } from "@/env"
import { healthCheckups } from "@/schema"
import { and, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class HealthCheckupRepository {
  constructor(private readonly c: Context) {}

  /** 実施記録を年度・従業員で絞り込み、実施年度の降順で返す。 */
  async find(props: {
    fiscalYear?: number
    employeeId?: number
  }): Promise<ReadonlyArray<HealthCheckup> | Error> {
    try {
      const conditions: Array<SQL> = []

      if (props.fiscalYear !== undefined) {
        conditions.push(eq(healthCheckups.fiscalYear, props.fiscalYear))
      }

      if (props.employeeId !== undefined) {
        conditions.push(eq(healthCheckups.employeeId, props.employeeId))
      }

      const where = conditions.length === 0 ? undefined : and(...conditions)

      const rows = await this.c.var.database
        .select()
        .from(healthCheckups)
        .where(where)
        .orderBy(desc(healthCheckups.fiscalYear), desc(healthCheckups.id))

      return rows.map((row) => HealthCheckup.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load health_checkups")
    }
  }

  /** id で 1 件取得する。存在しなければ null。 */
  async findById(id: number): Promise<HealthCheckup | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(healthCheckups)
        .where(eq(healthCheckups.id, id))

      const row = rows.at(0)

      return row === undefined ? null : HealthCheckup.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load health_checkup")
    }
  }

  /** 実施記録を INSERT する。結果カラムは持たない（実施情報のみ）。 */
  async create(props: {
    employeeId: number
    fiscalYear: number
    checkupKind: "regular" | "stress_check"
    conductedOn: string | null
    status: "scheduled" | "completed" | "declined"
    note: string | null
    createdAt: string
  }): Promise<HealthCheckup | Error> {
    try {
      const rows = await this.c.var.database
        .insert(healthCheckups)
        .values({
          employeeId: props.employeeId,
          fiscalYear: props.fiscalYear,
          checkupKind: props.checkupKind,
          conductedOn: props.conductedOn,
          status: props.status,
          note: props.note,
          createdAt: props.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to save health_checkup")
        : HealthCheckup.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save health_checkup")
    }
  }

  /** status を completed へ遷移し conducted_on を記録する。対象が scheduled でなければ null。 */
  async complete(props: {
    id: number
    conductedOn: string
  }): Promise<HealthCheckup | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(healthCheckups)
        .set({ status: "completed", conductedOn: props.conductedOn })
        .where(and(eq(healthCheckups.id, props.id), eq(healthCheckups.status, "scheduled")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : HealthCheckup.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update health_checkup")
    }
  }
}
