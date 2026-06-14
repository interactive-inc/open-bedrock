import type { Forbidden } from "@/lib/payroll/payroll-access"
import { canManagePayroll } from "@/lib/payroll/payroll-access"
import type { Context } from "@/env"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"

export type Command = {
  viewerRole: string
  payslipId: number
}

export type PayslipNotFound = { reason: "payslip_not_found" }

export type NotCancellable = { reason: "not_cancellable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 特権ロールが給与明細を取り消す。金額の再計算は行わず記録の削除のみを行う。
 * draft 状態の給与明細のみ削除を許可し、issued 等は拒否する。
 */
export class CancelPayslip {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | Forbidden | PayslipNotFound | NotCancellable | Error> {
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

    if (current.status !== "draft") {
      return { reason: "not_cancellable" }
    }

    const deleted = await payslipRepository.delete(command.payslipId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_cancellable" }
    }

    return { reason: "cancelled" }
  }
}
