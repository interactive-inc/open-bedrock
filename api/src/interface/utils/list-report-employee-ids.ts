import type { Context } from "@/env"
import { buildEmployeeCodeMap } from "@/contexts/company/infrastructure/organization/build-employee-code-map"
import { buildMembershipMap } from "@/contexts/company/infrastructure/organization/build-membership-map"
import { isReportOf } from "@/contexts/company/domain/organization/is-report-of"

export type Props = {
  c: Context
  viewerEmployeeId: number
}

/**
 * viewer の配下(再帰)にあたる従業員 id の一覧を org_memberships から解決する。
 * 直属に限らずレポートライン全体を対象にする。循環は isReportOf の visited で防ぐ。
 * viewer 自身は含めない。
 */
export async function listReportEmployeeIds(props: Props): Promise<Array<number> | Error> {
  const codesById = await buildEmployeeCodeMap(props.c)

  if (codesById instanceof Error) {
    return codesById
  }

  const viewerCode = codesById.get(props.viewerEmployeeId) ?? null

  if (viewerCode === null) {
    return []
  }

  const memberships = await buildMembershipMap(props.c)

  if (memberships instanceof Error) {
    return memberships
  }

  const reportEmployeeIds: Array<number> = []

  for (const entry of codesById.entries()) {
    const employeeId = entry[0]

    const employeeCode = entry[1]

    if (employeeId === props.viewerEmployeeId) {
      continue
    }

    const isReport = isReportOf({
      memberships,
      targetEmployeeCode: employeeCode,
      viewerEmployeeCode: viewerCode,
    })

    if (isReport) {
      reportEmployeeIds.push(employeeId)
    }
  }

  return reportEmployeeIds
}
