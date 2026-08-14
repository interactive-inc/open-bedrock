import { EmployeeGrade } from "@/domain/grade/employee-grade.entity"
import type { Context } from "@/env"
import { employeeGrades } from "@/schema"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { count, desc, eq } from "drizzle-orm"

export class EmployeeGradeRepository {
  constructor(private readonly c: Context) {}

  /** 社員の等級割当履歴を発効日の降順で返す。 */
  async findByEmployeeId(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<EmployeeGrade> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeGrades)
        .where(eq(employeeGrades.employeeId, props.employeeId))
        .orderBy(desc(employeeGrades.effectiveDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => EmployeeGrade.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_grades")
    }
  }

  async countByEmployeeId(employeeId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(employeeGrades)
        .where(eq(employeeGrades.employeeId, employeeId))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count employee_grades")
    }
  }

  async create(employeeGrade: EmployeeGrade): Promise<EmployeeGrade | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employeeGrades)
        .values({
          employeeId: employeeGrade.employeeId,
          gradeId: employeeGrade.gradeId,
          effectiveDate: employeeGrade.effectiveDate,
          reason: employeeGrade.reason,
          createdAt: employeeGrade.createdAt,
          reviewCycleId: employeeGrade.reviewCycleId,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create employee_grade")
        : EmployeeGrade.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("employee grade for this date already exists", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to create employee_grade")
    }
  }
}
