import { readCanonicalOrganizationState } from "@/contexts/company/application/organization/read-canonical-organization-state"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import type { Context } from "@/env"

export type Props = {
  c: Context
  employeeId: number
}

/**
 * 従業員の主所属コードをcanonical Company snapshotから解決する。無所属・不明ならnull。
 */
export async function resolveEmployeeDepartmentCode(props: Props): Promise<string | null | Error> {
  const snapshot = await readCanonicalOrganizationState(props.c)
  if (snapshot instanceof Error) return snapshot
  const employee = snapshot.employees.find(
    (candidate) => candidate.employeeId === toWorkforceEmployeeId(props.employeeId),
  )
  const organizationUnitId = employee?.primaryAssignment?.organizationUnitId
  if (organizationUnitId === undefined) return null

  return (
    snapshot.organization.units.find((unit) => unit.organizationUnitId === organizationUnitId)
      ?.code ?? null
  )
}
