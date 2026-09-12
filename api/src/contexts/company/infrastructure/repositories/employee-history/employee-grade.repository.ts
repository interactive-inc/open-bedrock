import { EmployeeGradeEntity } from "@/contexts/company/domain/entities/employee-grade.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employeeGrades } from "@/contexts/company/infrastructure/schema/grade"
import { count, desc, eq } from "drizzle-orm"

type Context = CompanyContext

export class EmployeeGradeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(input: {
    employeeId: EmployeeId
    limit: number
    offset: number
  }): Promise<ReadonlyArray<EmployeeGradeEntity> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeGrades)
        .where(eq(employeeGrades.employeeId, input.employeeId))
        .orderBy(desc(employeeGrades.effectiveDate), desc(employeeGrades.id))
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((row) => EmployeeGradeEntity.restore(row))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company employee grades")
    }
  }

  async countByEmployeeId(employeeId: EmployeeId): Promise<number | Error> {
    try {
      return (
        (
          await this.c.var.database
            .select({ total: count() })
            .from(employeeGrades)
            .where(eq(employeeGrades.employeeId, employeeId))
        )[0]?.total ?? 0
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company employee grades")
    }
  }
}
