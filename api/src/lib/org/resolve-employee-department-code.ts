import type { Context } from "@/env"
import { buildEmployeeCodeMap } from "@/lib/org/build-employee-code-map"
import { buildMembershipMap } from "@/lib/org/build-membership-map"

export type Props = {
  c: Context
  employeeId: number
}

/**
 * 従業員 id が所属する部門コードを org_memberships から解決する。無所属・不明なら null。
 */
export async function resolveEmployeeDepartmentCode(props: Props): Promise<string | null | Error> {
  const codesById = await buildEmployeeCodeMap(props.c)

  if (codesById instanceof Error) {
    return codesById
  }

  const employeeCode = codesById.get(props.employeeId) ?? null

  if (employeeCode === null) {
    return null
  }

  const memberships = await buildMembershipMap(props.c)

  if (memberships instanceof Error) {
    return memberships
  }

  return memberships.get(employeeCode)?.departmentCode ?? null
}
