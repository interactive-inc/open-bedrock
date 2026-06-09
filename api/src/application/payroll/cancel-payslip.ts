import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import type { Context } from "@/env"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"

export type Command = {
  viewerRole: string
  payslipId: number
}

export type PayslipNotFound = { reason: "payslip_not_found" }

export type AlreadyIssued = { reason: "already_issued" }

export type Cancelled = { reason: "cancelled" }

/**
 * 特権ロールが給与明細を取り消す。金額の再計算は行わず記録の削除のみを行う。
 */
export class CancelPayslip {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | Forbidden | PayslipNotFound | AlreadyIssued | Error> {
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
      return { reason: "already_issued" }
    }

    const deleted = await payslipRepository.delete(command.payslipId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
