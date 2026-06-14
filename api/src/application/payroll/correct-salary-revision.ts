import type { Forbidden } from "@/lib/payroll/payroll-access"
import { canManagePayroll } from "@/lib/payroll/payroll-access"
import { SalaryRevision } from "@/domain/payroll/salary-revision.entity"
import type { Context } from "@/env"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  viewerRole: string
  salaryRevisionId: number
  effectiveDate: string
  newBaseSalary: number
  reason: string | null
}

export type SalaryRevisionNotFound = { reason: "salary_revision_not_found" }

export type DuplicateEffectiveDate = { reason: "duplicate_effective_date" }

/**
 * 特権ロールが既存の給与改定の適用日・改定後基本給・理由を訂正する。計算は持たず渡された値で記録する。
 */
export class CorrectSalaryRevision {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<SalaryRevision | Forbidden | SalaryRevisionNotFound | DuplicateEffectiveDate | Error> {
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

    const withDetails = current
      .withEffectiveDate(command.effectiveDate)
      .withNewBaseSalary(command.newBaseSalary)
      .withReason(command.reason)

    // 適用日が変わると時系列上の直前の改定も変わりうるため、前回基本給を解決し直す。
    // 自分自身を直前として拾わないよう excludeId で除外する。
    const corrected = await this.toCorrectedWithPreviousBaseSalary(withDetails, current)

    if (corrected instanceof Error) {
      return corrected
    }

    const updated = await salaryRevisionRepository.update(corrected)

    if (updated instanceof Error && !(updated instanceof UniqueConstraintError)) {
      return updated
    }

    if (updated instanceof UniqueConstraintError) {
      return { reason: "duplicate_effective_date" }
    }

    if (updated === null) {
      return { reason: "salary_revision_not_found" }
    }

    return updated
  }

  // 適用日が変更された場合のみ、直前の改定から前回基本給を再解決する。
  private async toCorrectedWithPreviousBaseSalary(
    withDetails: SalaryRevision,
    current: SalaryRevision,
  ): Promise<SalaryRevision | Error> {
    if (withDetails.effectiveDate === current.effectiveDate) {
      return withDetails
    }

    const priorRevision = await new SalaryRevisionRepository(this.c).findLatestBeforeDate(
      current.employeeId,
      withDetails.effectiveDate,
      current.id,
    )

    if (priorRevision instanceof Error) {
      return priorRevision
    }

    return withDetails.withPreviousBaseSalary(SalaryRevision.previousBaseSalaryOf(priorRevision))
  }
}
