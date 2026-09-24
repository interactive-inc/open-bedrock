import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import type { Context } from "@/env"

type OrganizationUnits = Readonly<{
  /** 会社営業日に有効で、募集部署として新たに選べる組織単位か。会社そのものは選べない。 */
  isSelectable: (organizationUnitId: OrganizationUnitId) => boolean
  /** 表示名。会社営業日の名称を優先し、廃止済みなら最後の名称、未知なら null を返す。 */
  nameOf: (organizationUnitId: OrganizationUnitId) => string | null
}>

/** 社内公募の募集部署を、Company の公開 operation が返す組織 snapshot から解決する。 */
export class CareerOrganizationUnitAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async load(): Promise<OrganizationUnits | Error> {
    const snapshot = await readCompanyCanonicalOrganizationState(this.c)
    if (snapshot instanceof Error) return snapshot

    const asOf = snapshot.organization.asOf
    const periods = snapshot.organization.units.filter((unit) => !unit.isVoid)
    const current = new Map(
      periods
        .filter((unit) => periodContainsDate(unit, asOf))
        .map((unit) => [unit.organizationUnitId, unit]),
    )
    const latestNames = new Map<OrganizationUnitId, { startsOn: string; name: string }>()
    for (const unit of periods) {
      const known = latestNames.get(unit.organizationUnitId)
      if (known === undefined || known.startsOn < unit.startsOn) {
        latestNames.set(unit.organizationUnitId, {
          startsOn: unit.startsOn,
          name: unit.officialName,
        })
      }
    }

    return Object.freeze({
      isSelectable: (organizationUnitId: OrganizationUnitId) => {
        const unit = current.get(organizationUnitId)
        return unit !== undefined && unit.kind !== "COMPANY"
      },
      nameOf: (organizationUnitId: OrganizationUnitId) =>
        current.get(organizationUnitId)?.officialName ??
        latestNames.get(organizationUnitId)?.name ??
        null,
    })
  }
}
