import { SYSTEM_ROLE_PERMISSIONS } from "@/lib/auth/system-roles"
import type { SessionPayload } from "@/env"

// テスト用: system role(member/manager/hr/admin)から SessionPayload を組み立てる。
// その role が持つ permission 集合を SYSTEM_ROLE_PERMISSIONS から解決して載せる。
// application 層テストが can-*(session) を直接叩くために使う。

/**
 * role と employeeId から SessionPayload を作る。permissions はその system role の許可集合。
 */
export function makeTestSession(role: string, employeeId = 1): SessionPayload {
  const entry = SYSTEM_ROLE_PERMISSIONS.find((candidate) => candidate.key === role)

  const permissions = new Set<string>(entry === undefined ? [] : entry.permissions)

  return {
    accountId: employeeId,
    employeeId: employeeId,
    employeeStatus: "active",
    permissions: permissions,
    roleKeys: [role],
    role: role,
  }
}
