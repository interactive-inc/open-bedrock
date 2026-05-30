import { Payslip } from "@/domain/payroll/payslip"
import type { Context } from "@/env"
import { payslips } from "@/schema"

export class PayslipRepository {
  constructor(private readonly c: Context) {}

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
      return error instanceof Error ? error : new Error("failed to insert payslip")
    }
  }
}
