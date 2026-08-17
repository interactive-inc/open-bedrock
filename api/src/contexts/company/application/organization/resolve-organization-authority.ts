import type { OrganizationAuthority } from "@/contexts/company/domain/organization/organization-authority"
import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/workforce/resolve-employee-management-authority"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { readCanonicalOrganizationState } from "@/contexts/company/application/organization/read-canonical-organization-state"
import type { Context } from "@/env"

/**
 * 組織図上で actor が target に対して持つ管理関係を解決する。
 * IAM permission は「操作能力」、本関数は「対象範囲」だけを扱う。
 */
export async function resolveOrganizationAuthority(
  c: Context,
  actorEmployeeId: number,
  targetEmployeeId: number,
): Promise<OrganizationAuthority | Error> {
  const snapshot = await readCanonicalOrganizationState(c)
  if (snapshot instanceof Error) return snapshot

  return resolveEmployeeManagementAuthority({
    states: snapshot.employees,
    actorEmployeeId: toWorkforceEmployeeId(actorEmployeeId),
    targetEmployeeId: toWorkforceEmployeeId(targetEmployeeId),
  })
}
