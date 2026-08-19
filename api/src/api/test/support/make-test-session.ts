import { Session } from "@/contexts/company/domain/iam/session"
import { SYSTEM_ROLE_PERMISSIONS } from "@/api/test/support/system-roles"

/**
 * テスト用: system role(member/manager/hr/admin)と employeeId から Session を組み立てる。
 * permissions はその role の許可集合を SYSTEM_ROLE_PERMISSIONS から解決して載せる
 */
export function makeTestSession(role: string, employeeId = 1): Session {
  const entry = SYSTEM_ROLE_PERMISSIONS.find((candidate) => candidate.key === role)

  const permissions = new Set<string>(entry === undefined ? [] : entry.permissions)

  return new Session({
    accountId: employeeId,
    employeeId: employeeId,
    employeeStatus: "active",
    permissions: permissions,
    roleKeys: [role],
  })
}
