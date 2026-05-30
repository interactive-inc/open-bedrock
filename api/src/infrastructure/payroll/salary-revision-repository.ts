import { SalaryRevision } from "@/domain/payroll/salary-revision"
import type { Context } from "@/env"
import { salaryRevisions } from "@/schema"
import { desc, eq } from "drizzle-orm"

export class SalaryRevisionRepository {
  constructor(private readonly c: Context) {}

  async findLatestByEmployeeId(employeeId: number): Promise<SalaryRevision | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(salaryRevisions)
        .where(eq(salaryRevisions.employeeId, employeeId))
        .orderBy(desc(salaryRevisions.effectiveDate))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : SalaryRevision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load salary revision")
    }
  }

  async create(salaryRevision: SalaryRevision): Promise<SalaryRevision | Error> {
    try {
      const rows = await this.c.var.database
        .insert(salaryRevisions)
        .values({
          employeeId: salaryRevision.employeeId,
          effectiveDate: salaryRevision.effectiveDate,
          previousBaseSalary: salaryRevision.previousBaseSalary,
          newBaseSalary: salaryRevision.newBaseSalary,
          reason: salaryRevision.reason,
          createdAt: salaryRevision.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert salary revision")
        : SalaryRevision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert salary revision")
    }
  }
}
