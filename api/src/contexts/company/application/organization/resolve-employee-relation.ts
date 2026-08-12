import type { Context } from "@/env"
import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"
import { buildEmployeeCodeMap } from "@/contexts/company/infrastructure/organization/build-employee-code-map"
import { buildMembershipMap } from "@/contexts/company/infrastructure/organization/build-membership-map"
import { toEmployeeRelation } from "@/contexts/company/domain/organization/to-employee-relation"

export type Props = {
  c: Context
  viewerEmployeeId: number
  targetEmployeeId: number
}

/**
 * viewer と target の組織上の関係を org_memberships から解決する。
 * 数百人規模を前提に全件ロードしてメモリ上で走査する。
 */
export async function resolveEmployeeRelation(props: Props): Promise<EmployeeRelation | Error> {
  if (props.viewerEmployeeId === props.targetEmployeeId) {
    return { isSelf: true, isReport: false, isSameDepartment: false }
  }

  const codesById = await buildEmployeeCodeMap(props.c)

  if (codesById instanceof Error) {
    return codesById
  }

  const viewerCode = codesById.get(props.viewerEmployeeId) ?? null

  const targetCode = codesById.get(props.targetEmployeeId) ?? null

  if (viewerCode === null || targetCode === null) {
    return { isSelf: false, isReport: false, isSameDepartment: false }
  }

  const memberships = await buildMembershipMap(props.c)

  if (memberships instanceof Error) {
    return memberships
  }

  return toEmployeeRelation({
    memberships,
    viewerEmployeeCode: viewerCode,
    targetEmployeeCode: targetCode,
  })
}
