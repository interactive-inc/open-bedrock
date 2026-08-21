import { WorkAccident } from "@/contexts/work-accident/domain/work-accident.entity"
import type { Context } from "@/env"
import { workAccidents } from "@/contexts/work-accident/infrastructure/schema/work-accident"
import { and, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class WorkAccidentRepository {
  constructor(private readonly c: Context) {}

  /** 発生記録を status・employee_id で絞り込み、発生日の降順で返す。 */
  async find(props: {
    status?: string
    employeeId?: number
  }): Promise<ReadonlyArray<WorkAccident> | Error> {
    try {
      const conditions: Array<SQL> = []

      if (props.status !== undefined) {
        conditions.push(eq(workAccidents.status, props.status))
      }

      if (props.employeeId !== undefined) {
        conditions.push(eq(workAccidents.employeeId, props.employeeId))
      }

      const where = conditions.length === 0 ? undefined : and(...conditions)

      const rows = await this.c.var.database
        .select()
        .from(workAccidents)
        .where(where)
        .orderBy(desc(workAccidents.occurredOn), desc(workAccidents.id))

      return rows.map((row) => WorkAccident.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load work_accidents")
    }
  }

  /** id で 1 件取得する。存在しなければ null。 */
  async findById(id: number): Promise<WorkAccident | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(workAccidents)
        .where(eq(workAccidents.id, id))

      const row = rows.at(0)

      return row === undefined ? null : WorkAccident.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load work_accident")
    }
  }

  /** 発生記録を INSERT する。対象者不特定の事故もあるため employeeId は null 可。 */
  async create(props: {
    occurredOn: string
    employeeId: number | null
    location: string | null
    summary: string
    severity: "minor" | "serious" | null
    status: "reported" | "closed"
    createdAt: string
  }): Promise<WorkAccident | Error> {
    try {
      const rows = await this.c.var.database
        .insert(workAccidents)
        .values({
          occurredOn: props.occurredOn,
          employeeId: props.employeeId,
          location: props.location,
          summary: props.summary,
          severity: props.severity,
          status: props.status,
          createdAt: props.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to save work_accident")
        : WorkAccident.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save work_accident")
    }
  }

  /** status を closed へ遷移する。対象が reported でなければ null。 */
  async close(id: number): Promise<WorkAccident | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(workAccidents)
        .set({ status: "closed" })
        .where(and(eq(workAccidents.id, id), eq(workAccidents.status, "reported")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : WorkAccident.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update work_accident")
    }
  }
}
