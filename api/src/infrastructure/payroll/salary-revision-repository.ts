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

  async findById(id: number): Promise<SalaryRevision | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(salaryRevisions)
        .where(eq(salaryRevisions.id, id))
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

  // 既存の給与改定の適用日・改定後基本給・理由を訂正する。
  async update(salaryRevision: SalaryRevision): Promise<SalaryRevision | Error> {
    try {
      await this.c.var.database
        .update(salaryRevisions)
        .set({
          effectiveDate: salaryRevision.effectiveDate,
          newBaseSalary: salaryRevision.newBaseSalary,
          reason: salaryRevision.reason,
        })
        .where(eq(salaryRevisions.id, salaryRevision.id ?? 0))

      return salaryRevision
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update salary revision")
    }
  }

  // 給与改定を削除する（記録の取消）。
  async delete(id: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(salaryRevisions).where(eq(salaryRevisions.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete salary revision")
    }
  }
}
