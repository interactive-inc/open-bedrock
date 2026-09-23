import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { Context } from "@/env"

export type Props = {
  c: Context
  employeeId: EmployeeId
}

/**
 * 従業員の主所属コードをcanonical Company snapshotから解決する。無所属・不明ならnull。
 */
export async function resolveEmployeeDepartmentCode(props: Props): Promise<string | null | Error> {
  const snapshot = await readCompanyCanonicalOrganizationState(props.c)
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
