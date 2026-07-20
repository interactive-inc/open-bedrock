import { EmployeeEvent } from "@/domain/employee-event/employee-event.entity"
import type { Context } from "@/env"
import { employeeEvents } from "@/schema"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class EmployeeEventRepository {
  constructor(private readonly c: Context) {}

  /** 社員の在籍イベント履歴を発効日の降順で返す。kind 指定で種別を絞り込む。 */
  async findByEmployeeId(props: {
    employeeId: number
    kind: string | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<EmployeeEvent> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeEvents)
        .where(this.toConditions(props.employeeId, props.kind))
        .orderBy(desc(employeeEvents.effectiveDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => EmployeeEvent.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_events")
    }
  }

  async countByEmployeeId(props: {
    employeeId: number
    kind: string | null
  }): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(employeeEvents)
        .where(this.toConditions(props.employeeId, props.kind))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count employee_events")
    }
  }

  async create(employeeEvent: EmployeeEvent): Promise<EmployeeEvent | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employeeEvents)
        .values({
          employeeId: employeeEvent.employeeId,
          kind: employeeEvent.kind,
          effectiveDate: employeeEvent.effectiveDate,
          fromDepartmentCode: employeeEvent.fromDepartmentCode,
          toDepartmentCode: employeeEvent.toDepartmentCode,
          note: employeeEvent.note,
          createdAt: employeeEvent.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create employee_event")
        : EmployeeEvent.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create employee_event")
    }
  }

  private toConditions(employeeId: number, kind: string | null): SQL | undefined {
    const conditions: Array<SQL> = [eq(employeeEvents.employeeId, employeeId)]

    if (kind !== null) {
      conditions.push(eq(employeeEvents.kind, kind))
    }

    return and(...conditions)
  }
}
