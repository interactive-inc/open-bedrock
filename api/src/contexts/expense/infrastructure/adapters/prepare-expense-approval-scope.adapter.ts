import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"

type Context = CompanyContext

/** 経費に固定した負担組織を現在の会社台帳で解決し、判断までの変更を検知する。 */
export class PrepareExpenseApprovalScopeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ organizationUnitId: OrganizationUnitId; at: Date }>) {
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ accountIds: [], employeeCodes: [] })
    if (guard instanceof Error) return guard
    const snapshot = await new ReadCanonicalOrganizationStateAdapter({
      var: this.c.var,
      env: { ...this.c.env, NOW: input.at.toISOString() },
    }).readCanonicalOrganizationState()
    if (snapshot instanceof Error) return snapshot
    const organization = snapshot.organization.units.find(
      (unit) => unit.organizationUnitId === input.organizationUnitId,
    )
    if (organization === undefined) return new Error("経費の負担組織を確認できません")
    return { targetDepartmentCode: organization.code, name: organization.officialName, guard }
  }
}
