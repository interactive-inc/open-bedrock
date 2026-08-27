import { EmployeeEntity } from "@/contexts/company/domain/entities/employee.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { eq } from "drizzle-orm"

type Context = CompanyContext

export class EmployeeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findById(id: EmployeeId): Promise<EmployeeEntity | null | Error> {
    try {
      const row = (
        await this.c.var.database.select().from(employees).where(eq(employees.id, id)).limit(1)
      )[0]
      if (row === undefined) return null
      return EmployeeEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find Company employee")
    }
  }

  async findByCode(code: string): Promise<EmployeeEntity | null | Error> {
    try {
      const row = (
        await this.c.var.database
          .select()
          .from(employees)
          .where(eq(employees.employeeCode, code))
          .limit(1)
      )[0]
      if (row === undefined) return null
      return EmployeeEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find Company employee")
    }
  }

  async update(entity: EmployeeEntity, updatedAt: Date): Promise<EmployeeEntity | null | Error> {
    try {
      const props = entity.toProps()
      const row = (
        await this.c.var.database
          .update(employees)
          .set({
            officialName: props.officialName,
            email: props.email,
            phone: props.phone,
            updatedAt,
          })
          .where(eq(employees.id, props.id))
          .returning()
      )[0]
      if (row === undefined) return null
      return EmployeeEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to update Company employee")
    }
  }
}
