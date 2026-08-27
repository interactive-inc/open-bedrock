import { EmployeeGradeEntity } from "@/contexts/company/domain/entities/employee-grade.entity"
import { CompanyUniqueConstraintError } from "@/contexts/company/domain/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employeeGrades } from "@/contexts/company/infrastructure/schema/grade"
import { isCompanyUniqueConstraintError } from "@/contexts/company/lib/employee/is-company-unique-constraint-error"
import { count, desc, eq } from "drizzle-orm"

type Context = CompanyContext

export class EmployeeGradeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByEmployeeId(input: {
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

  async create(entity: EmployeeGradeEntity): Promise<EmployeeGradeEntity | Error> {
    try {
      const props = entity.toProps()
      const row = (
        await this.c.var.database
          .insert(employeeGrades)
          .values({
            employeeId: props.employeeId,
            gradeId: props.gradeId,
            effectiveDate: props.effectiveDate,
            reason: props.reason,
            createdAt: props.createdAt,
          })
          .returning()
      )[0]
      return row === undefined
        ? new Error("failed to create Company employee grade")
        : EmployeeGradeEntity.restore(row)
    } catch (cause) {
      return isCompanyUniqueConstraintError(cause)
        ? new CompanyUniqueConstraintError("employee grade already exists", { cause })
        : cause instanceof Error
          ? cause
          : new Error("failed to create Company employee grade")
    }
  }
}
