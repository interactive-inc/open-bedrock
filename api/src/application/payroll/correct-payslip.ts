import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import { Payslip } from "@/domain/payroll/payslip"
import type { Context } from "@/env"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"

export type Command = {
  viewerRole: string
  payslipId: number
  period: string
  baseSalary: number
  allowances: number
  deductions: number
  netPay: number
}

export type PayslipNotFound = { reason: "payslip_not_found" }

export type NotEditable = { reason: "not_editable" }

/**
 * 特権ロールが給与明細の期間と金額を訂正する。金額は渡された値をそのまま記録する。
 */
export class CorrectPayslip {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Payslip | Forbidden | PayslipNotFound | NotEditable | Error> {
    if (canManagePayroll(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const payslipRepository = new PayslipRepository(this.c)

    const current = await payslipRepository.findById(command.payslipId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "payslip_not_found" }
    }

    if (current.status !== "issued") {
      return { reason: "not_editable" }
    }

    const corrected = current.withCorrected({
      period: command.period,
      baseSalary: command.baseSalary,
      allowances: command.allowances,
      deductions: command.deductions,
      netPay: command.netPay,
    })

    const updated = await payslipRepository.update(corrected)

    if (updated === null) {
      return { reason: "not_editable" }
    }

    return updated
  }
}
