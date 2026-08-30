import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SalaryRevision } from "@/contexts/compensation-change/domain/entities/salary-revision.entity"
import type { Context } from "@/env"
import { salaryRevisions } from "@/contexts/compensation-change/infrastructure/schema/compensation-change"
import { count, desc, eq } from "drizzle-orm"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/errors"

export class SalaryRevisionRepository {
  constructor(private readonly c: Context) {}

  /** 社員の給与改定履歴を適用日の降順で返す。 */
  async findByEmployeeId(props: {
    employeeId: EmployeeId
    limit: number
    offset: number
  }): Promise<ReadonlyArray<SalaryRevision> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(salaryRevisions)
        .where(eq(salaryRevisions.employeeId, props.employeeId))
        .orderBy(desc(salaryRevisions.effectiveDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => SalaryRevision.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load salary_revisions")
    }
  }

  async countByEmployeeId(employeeId: EmployeeId): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(salaryRevisions)
        .where(eq(salaryRevisions.employeeId, employeeId))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count salary_revisions")
    }
  }

  async create(revision: SalaryRevision): Promise<SalaryRevision | Error> {
    try {
      const rows = await this.c.var.database
        .insert(salaryRevisions)
        .values({
          employeeId: revision.employeeId,
          effectiveDate: revision.effectiveDate,
          previousBaseSalary: revision.previousBaseSalary,
          newBaseSalary: revision.newBaseSalary,
          reason: revision.reason,
          createdAt: revision.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert salary_revision")
        : SalaryRevision.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("salary revision for this date already exists", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to insert salary_revision")
    }
  }
}
