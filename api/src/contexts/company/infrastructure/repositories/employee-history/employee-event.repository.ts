import { EmployeeEventEntity } from "@/contexts/company/domain/entities/employee-event.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employeeEvents } from "@/contexts/company/infrastructure/schema/employee-event"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

type Context = CompanyContext

export class EmployeeEventRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByEmployeeId(input: {
    employeeId: EmployeeId
    kind: string | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<EmployeeEventEntity> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeEvents)
        .where(this.conditions(input.employeeId, input.kind))
        .orderBy(desc(employeeEvents.effectiveDate), desc(employeeEvents.id))
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((row) => EmployeeEventEntity.restore(row))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company employee events")
    }
  }

  async countByEmployeeId(input: {
    employeeId: EmployeeId
    kind: string | null
  }): Promise<number | Error> {
    try {
      return (
        (
          await this.c.var.database
            .select({ total: count() })
            .from(employeeEvents)
            .where(this.conditions(input.employeeId, input.kind))
        )[0]?.total ?? 0
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company employee events")
    }
  }

  async create(entity: EmployeeEventEntity): Promise<EmployeeEventEntity | Error> {
    try {
      const props = entity.toProps()
      const row = (
        await this.c.var.database
          .insert(employeeEvents)
          .values({
            employeeId: props.employeeId,
            kind: props.kind,
            effectiveDate: props.effectiveDate,
            fromDepartmentCode: props.fromDepartmentCode,
            toDepartmentCode: props.toDepartmentCode,
            note: props.note,
            createdAt: props.createdAt,
          })
          .returning()
      )[0]
      return row === undefined
        ? new Error("failed to create Company employee event")
        : EmployeeEventEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to create Company employee event")
    }
  }

  private conditions(employeeId: EmployeeId, kind: string | null): SQL | undefined {
    return and(
      eq(employeeEvents.employeeId, employeeId),
      ...(kind === null ? [] : [eq(employeeEvents.kind, kind)]),
    )
  }
}
