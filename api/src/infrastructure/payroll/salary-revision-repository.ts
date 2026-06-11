import { SalaryRevision } from "@/domain/payroll/salary-revision"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { salaryRevisions } from "@/schema"
import { and, desc, eq, lt, ne } from "drizzle-orm"

export class SalaryRevisionRepository {
  constructor(private readonly c: Context) {}

  // 指定 effectiveDate より前で最も新しい改定を返す。バックデート登録時の「前回基本給」解決に使う。
  // effectiveDate が同日のものは含めない（直前の改定のみ対象）。
  // excludeId を渡すとその改定を除外する（訂正時に自分自身を直前として拾わないため）。
  async findLatestBeforeDate(
    employeeId: number,
    effectiveDate: string,
    excludeId: number | null = null,
  ): Promise<SalaryRevision | null | Error> {
    try {
      const conditions = [
        eq(salaryRevisions.employeeId, employeeId),
        lt(salaryRevisions.effectiveDate, effectiveDate),
      ]

      if (excludeId !== null) {
        conditions.push(ne(salaryRevisions.id, excludeId))
      }

      const rows = await this.c.var.database
        .select()
        .from(salaryRevisions)
        .where(and(...conditions))
        .orderBy(desc(salaryRevisions.effectiveDate), desc(salaryRevisions.id))
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

  async create(
    salaryRevision: SalaryRevision,
  ): Promise<SalaryRevision | UniqueConstraintError | Error> {
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
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError(
          "salary revision already exists for the employee and effective date",
          { cause: error },
        )
      }
      return error instanceof Error ? error : new Error("failed to insert salary revision")
    }
  }

  // 既存の給与改定の適用日・前回基本給・改定後基本給・理由を訂正する。id は採番済みの前提。
  // 0 行更新（削除済み等）は null を返す。
  async update(salaryRevision: SalaryRevision): Promise<SalaryRevision | null | Error> {
    if (salaryRevision.id === null) {
      return new Error("salary revision id is required to update")
    }

    try {
      const rows = await this.c.var.database
        .update(salaryRevisions)
        .set({
          effectiveDate: salaryRevision.effectiveDate,
          previousBaseSalary: salaryRevision.previousBaseSalary,
          newBaseSalary: salaryRevision.newBaseSalary,
          reason: salaryRevision.reason,
        })
        .where(eq(salaryRevisions.id, salaryRevision.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : SalaryRevision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update salary revision")
    }
  }

  // 給与改定を削除する（記録の取消）。0 行削除（存在しない等）は null を返す。
  async delete(id: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(salaryRevisions)
        .where(eq(salaryRevisions.id, id))
        .returning({ id: salaryRevisions.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete salary revision")
    }
  }
}
