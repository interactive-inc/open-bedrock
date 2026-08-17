import { readCanonicalOrganizationState } from "@/contexts/company/application/organization/read-canonical-organization-state"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"
import { resolveWorkforceEmployeeRelation } from "@/contexts/company/domain/workforce/resolve-employee-management-authority"
import type { Context } from "@/env"

export type Props = {
  c: Context
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
