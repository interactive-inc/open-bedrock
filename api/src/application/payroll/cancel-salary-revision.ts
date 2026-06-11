import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import type { Context } from "@/env"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"

export type Command = {
  viewerRole: string
  salaryRevisionId: number
}

export type SalaryRevisionNotFound = { reason: "salary_revision_not_found" }

export type Cancelled = { reason: "cancelled" }

/**
 * 特権ロールが既存の給与改定を取消（削除）する。計算は持たず記録の削除のみ。
 */
export class CancelSalaryRevision {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | Forbidden | SalaryRevisionNotFound | Error> {
    if (canManagePayroll(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const salaryRevisionRepository = new SalaryRevisionRepository(this.c)

    const current = await salaryRevisionRepository.findById(command.salaryRevisionId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "salary_revision_not_found" }
    }

    const deleted = await salaryRevisionRepository.delete(command.salaryRevisionId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "salary_revision_not_found" }
    }

    return { reason: "cancelled" }
  }
}
