import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"

export type ActiveHeadcount = Readonly<{
  total: number
  byOrganizationUnitCode: ReadonlyMap<string, number>
}>

/** 検証済みCompany snapshotから、同じ社員を組織単位ごとに一度だけ数える。 */
export async function readActiveHeadcount(c: CompanyContext): Promise<ActiveHeadcount | Error> {
  const snapshot = await readCanonicalOrganizationState(c)
  if (snapshot instanceof Error) return snapshot

  const organizationCodeById = new Map(
    snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit.code]),
  )
  const byOrganizationUnitCode = new Map<string, number>()
  const activeStates = snapshot.employees.filter((state) => state.status === "ACTIVE")

  for (const state of activeStates) {
    const organizationUnitIds = new Set([
      ...(state.primaryAssignment === null ? [] : [state.primaryAssignment.organizationUnitId]),
      ...state.concurrentAssignments.map((assignment) => assignment.organizationUnitId),
    ])

    for (const organizationUnitId of organizationUnitIds) {
      const code = organizationCodeById.get(organizationUnitId)
      if (code === undefined) continue
      byOrganizationUnitCode.set(code, (byOrganizationUnitCode.get(code) ?? 0) + 1)
    }
  }

  return { total: activeStates.length, byOrganizationUnitCode }
}
