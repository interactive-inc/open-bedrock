import { Payslip } from "@/domain/payroll/payslip"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { payslips } from "@/schema"
import { and, eq } from "drizzle-orm"

export class PayslipRepository {
  constructor(private readonly c: Context) {}

  // 給与明細 id で1件取得する。存在しなければ null。
  async findById(id: number): Promise<Payslip | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(payslips)
        .where(eq(payslips.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Payslip.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load payslip")
    }
  }

  // 社員と期間で給与明細を1件取得する。存在しなければ null。重複発行ガードに使う。
  async findByEmployeeAndPeriod(
    employeeId: number,
    period: string,
  ): Promise<Payslip | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(payslips)
        .where(and(eq(payslips.employeeId, employeeId), eq(payslips.period, period)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Payslip.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load payslip")
    }
  }

  async create(payslip: Payslip): Promise<Payslip | Error> {
    try {
      const rows = await this.c.var.database
        .insert(payslips)
        .values({
          employeeId: payslip.employeeId,
          period: payslip.period,
          baseSalary: payslip.baseSalary,
          allowances: payslip.allowances,
          deductions: payslip.deductions,
          netPay: payslip.netPay,
          issuedAt: payslip.issuedAt,
          status: payslip.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert payslip") : Payslip.fromRow(row)
    } catch (error) {
      // (employee_id, period) の UNIQUE 索引違反 = 同一期間の二重発行。型付きで返し、
      // 呼び出し側が再読込に依存せず重複として扱えるようにする。
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("payslip already exists for the employee and period", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to insert payslip")
    }
  }

  // 給与明細の期間と金額を訂正する。id は採番済みの前提。
  async update(payslip: Payslip): Promise<Payslip | Error> {
    if (payslip.id === null) {
      return new Error("payslip id is required to update")
    }

    try {
      await this.c.var.database
        .update(payslips)
        .set({
          period: payslip.period,
          baseSalary: payslip.baseSalary,
          allowances: payslip.allowances,
          deductions: payslip.deductions,
          netPay: payslip.netPay,
        })
        .where(eq(payslips.id, payslip.id))

      return payslip
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update payslip")
    }
  }

  // 給与明細を削除する。
  async delete(id: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(payslips).where(eq(payslips.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete payslip")
    }
  }
}
