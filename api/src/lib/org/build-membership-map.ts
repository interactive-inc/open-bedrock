import type { Context } from "@/env"
import type { MembershipEntry } from "@/lib/org/is-report-of"
import { orgMemberships } from "@/schema"

/**
 * org_memberships を全件読み、employeeCode → 最初の membership の対応を作る。
 * 同一従業員が複数 membership を持つ場合は最初の1件のみ採用する。
 */
export async function buildMembershipMap(
  c: Context,
): Promise<Map<string, MembershipEntry> | Error> {
  try {
    const rows = await c.var.database
      .select({
        employeeCode: orgMemberships.employeeCode,
        departmentCode: orgMemberships.departmentCode,
        managerEmployeeCode: orgMemberships.managerEmployeeCode,
      })
      .from(orgMemberships)

    const membershipsByCode = new Map<string, MembershipEntry>()

    for (const row of rows) {
      if (membershipsByCode.has(row.employeeCode) === false) {
        membershipsByCode.set(row.employeeCode, {
          departmentCode: row.departmentCode,
          managerEmployeeCode: row.managerEmployeeCode,
        })
      }
    }

    return membershipsByCode
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to load org_memberships")
  }
}
