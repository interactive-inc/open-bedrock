import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { resolveCompanyOrganizationAuthority } from "@/contexts/company/interface/operations/resolve-company-organization-authority"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Context } from "@/env"
import { ShiftError } from "@/contexts/shift/domain/errors"

/**
 * シフト交代の判断者が申請者と交代相手の両方に対するCompany上の管理範囲を持つかを判断時点で解決し、
 * 保存と同じbatchで参照したCompany状態が変わっていないことを再検査する文を返す。評価できなければ拒否する。
 */
export class ShiftSwapDecisionAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      session: CompanySessionValue
      subjectEmployeeIds: ReadonlyArray<EmployeeId>
    }>,
  ): Promise<Readonly<{ guards: ReadonlyArray<D1PreparedStatement> }> | ShiftError> {
    if (input.subjectEmployeeIds.length === 0)
      return new ShiftError("company_authority_unavailable", "decision subject is missing")
    if (input.subjectEmployeeIds.includes(input.session.employeeId))
      return new ShiftError("self_decision_forbidden", "cannot decide own shift swap")
    const guard = await prepareCompanyAuthoritySnapshotGuard(
      { database: this.c.env.DB },
      { accountIds: [input.session.accountId], employeeCodes: [] },
    )
    if (guard instanceof Error)
      return new ShiftError(
        "company_authority_unavailable",
        "company authority snapshot is unavailable",
        {
          cause: guard,
        },
      )
    for (const subjectEmployeeId of new Set(input.subjectEmployeeIds)) {
      const authority = await resolveCompanyOrganizationAuthority(
        this.c,
        input.session.employeeId,
        subjectEmployeeId,
      )
      if (authority instanceof Error)
        return new ShiftError(
          "company_authority_unavailable",
          "company authority cannot be resolved",
          {
            cause: authority,
          },
        )
      if (!authority.managementChain && !authority.departmentManager)
        return new ShiftError(
          "company_authority_required",
          "company authority over both swap parties is required",
        )
    }
    return { guards: [guard] }
  }
}
