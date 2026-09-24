import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { resolveCompanyOrganizationAuthority } from "@/contexts/company/interface/operations/resolve-company-organization-authority"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Context } from "@/env"
import { BusinessTripError } from "@/contexts/business-trip/domain/errors"

/**
 * 出張申請の判断者がCompany上の管理範囲を持つかを判断時点で解決し、保存と同じbatchで
 * 参照したCompany状態が変わっていないことを再検査する文を返す。評価できなければ拒否する。
 */
export class BusinessTripDecisionAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{ session: CompanySessionValue; subjectEmployeeId: EmployeeId }>,
  ): Promise<Readonly<{ guards: ReadonlyArray<D1PreparedStatement> }> | BusinessTripError> {
    if (input.session.employeeId === input.subjectEmployeeId)
      return new BusinessTripError("self_decision_forbidden", "cannot decide own business trip")
    const guard = await prepareCompanyAuthoritySnapshotGuard(
      { database: this.c.env.DB },
      { accountIds: [input.session.accountId], employeeCodes: [] },
    )
    if (guard instanceof Error)
      return new BusinessTripError(
        "company_authority_unavailable",
        "company authority snapshot is unavailable",
        { cause: guard },
      )
    const authority = await resolveCompanyOrganizationAuthority(
      this.c,
      input.session.employeeId,
      input.subjectEmployeeId,
    )
    if (authority instanceof Error)
      return new BusinessTripError(
        "company_authority_unavailable",
        "company authority cannot be resolved",
        { cause: authority },
      )
    if (!authority.managementChain && !authority.departmentManager)
      return new BusinessTripError(
        "company_authority_required",
        "company authority over the traveler is required",
      )
    return { guards: [guard] }
  }
}
