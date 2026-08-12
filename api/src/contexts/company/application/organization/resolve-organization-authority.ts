import type { Context } from "@/env"
import type { OrganizationAuthority } from "@/contexts/company/domain/organization/organization-authority"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { resolveLegacyOrganizationAuthority } from "@/contexts/company/infrastructure/organization/resolve-legacy-organization-authority"
import { resolveLifecycleOrganizationAuthority } from "@/contexts/company/application/organization/resolve-lifecycle-organization-authority"

/**
 * 組織図上で actor が target に対して持つ管理関係を解決する。
 * IAM permission は「操作能力」、本関数は「対象範囲」だけを扱う。
 */
export async function resolveOrganizationAuthority(
  c: Context,
  actorEmployeeId: number,
  targetEmployeeId: number,
): Promise<OrganizationAuthority | Error> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof Error) return migrationStatus
  return migrationStatus === "verified"
    ? resolveLifecycleOrganizationAuthority(c, actorEmployeeId, targetEmployeeId)
    : resolveLegacyOrganizationAuthority(c, actorEmployeeId, targetEmployeeId)
}
