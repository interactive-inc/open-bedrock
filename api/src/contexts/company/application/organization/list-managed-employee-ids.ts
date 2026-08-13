import type { Context } from "@/env"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { listLegacyManagedEmployeeIds } from "@/contexts/company/infrastructure/organization/list-legacy-managed-employee-ids"
import { listLifecycleManagedEmployeeIds } from "@/contexts/company/application/organization/list-lifecycle-managed-employee-ids"

/** actor が管理できる社員IDを返す。受信箱の絞り込みに使う。 */
export async function listManagedEmployeeIds(
  c: Context,
  actorEmployeeId: number,
): Promise<ReadonlyArray<number> | Error> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof Error) return migrationStatus
  return migrationStatus === "verified"
    ? listLifecycleManagedEmployeeIds(c, actorEmployeeId)
    : listLegacyManagedEmployeeIds(c, actorEmployeeId)
}
