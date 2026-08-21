import type { OrganizationAuthority } from "@/contexts/company/domain/definitions/organization-authority.definition"
import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/policies/resolve-employee-management-authority.policy"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"

/**
 * 組織図上で actor が target に対して持つ管理関係を解決する。
 * IAM permission は「操作能力」、本関数は「対象範囲」だけを扱う。
 */
export async function resolveOrganizationAuthority(
  c: CompanyContext,
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
