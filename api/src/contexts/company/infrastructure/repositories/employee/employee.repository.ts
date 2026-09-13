import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeEntity } from "@/contexts/company/domain/entities/employee.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { eq } from "drizzle-orm"

type Context = CompanyContext

type FindEmployeeProps =
  | Readonly<{ id: EmployeeId; code?: never }>
  | Readonly<{ code: string; id?: never; asOf?: CalendarDate }>

export class EmployeeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(props: FindEmployeeProps): Promise<EmployeeEntity | null | Error> {
    if (props.id !== undefined) {
      try {
        const row = (
          await this.c.var.database
            .select()
            .from(employees)
            .where(eq(employees.id, props.id))
            .limit(1)
        )[0]
        if (row === undefined) return null
        return EmployeeEntity.restore(row)
      } catch (cause) {
        return cause instanceof Error ? cause : new Error("failed to find Company employee")
      }
    }

    const employee = await new CompanyEmployeeDirectoryReadAdapter({
      env: this.c.env,
      asOf: props.asOf,
    }).findByCode(props.code)
    if (employee === null || employee instanceof Error) return employee
    return EmployeeEntity.restore(employee)
  }
}
