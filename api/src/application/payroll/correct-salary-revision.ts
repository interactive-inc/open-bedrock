import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import type { SalaryRevision } from "@/domain/payroll/salary-revision"
import type { Context } from "@/env"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"

export type Command = {
  viewerRole: string
  salaryRevisionId: number
  effectiveDate: string
  newBaseSalary: number
  reason: string | null
}

export type SalaryRevisionNotFound = { reason: "salary_revision_not_found" }

/**
 * 特権ロールが既存の給与改定の適用日・改定後基本給・理由を訂正する。計算は持たず渡された値で記録する。
 */
export class CorrectSalaryRevision {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<SalaryRevision | Forbidden | SalaryRevisionNotFound | Error> {
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

    const corrected = current
      .withEffectiveDate(command.effectiveDate)
      .withNewBaseSalary(command.newBaseSalary)
      .withReason(command.reason)

    const updated = await salaryRevisionRepository.update(corrected)

    if (updated === null) {
      return { reason: "salary_revision_not_found" }
    }

    return updated
  }
}
