import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import type { EmployeeRelation } from "@/contexts/company/domain/values/employee-relation.definition"
import { resolveWorkforceEmployeeRelation } from "@/contexts/company/domain/policies/resolve-workforce-employee-relation.policy"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"

export type Props = {
  c: CompanyContext
  viewerEmployeeId: number
  targetEmployeeId: number
}

/**
 * viewer と target の組織上の関係をcanonical Company snapshotから解決する。
 */
export async function resolveEmployeeRelation(props: Props): Promise<EmployeeRelation | Error> {
  const snapshot = await readCanonicalOrganizationState(props.c)
  if (snapshot instanceof Error) return snapshot

  return resolveWorkforceEmployeeRelation({
    states: snapshot.employees,
    viewerEmployeeId: toWorkforceEmployeeId(props.viewerEmployeeId),
    targetEmployeeId: toWorkforceEmployeeId(props.targetEmployeeId),
  })
}
