import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { SYSTEM_ROLE_PERMISSIONS } from "@tests/api/support/system-roles"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

/**
 * テスト用: system role(member/manager/hr/admin)と employeeId からCompanyの認証済み主体を組み立てる。
 * permissions はその role の許可集合を SYSTEM_ROLE_PERMISSIONS から解決して載せる
 */
export function makeTestSession(
  role: string,
  employeeId: number | AccountId = 1,
): CompanySessionValue {
  const entry = SYSTEM_ROLE_PERMISSIONS.find((candidate) => candidate.key === role)

  const permissions = new Set<string>(entry === undefined ? [] : entry.permissions)

  return new CompanySessionValue({
    accountId: zAccountId.parse(String(employeeId)),
    employeeId: toWorkforceEmployeeId(employeeId),
    employmentStatus: "ACTIVE",
    permissions: permissions,
    roleKeys: [role],
  })
}
