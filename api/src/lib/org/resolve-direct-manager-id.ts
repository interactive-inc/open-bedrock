import type { Context } from "@/env"
import { employees, orgMemberships } from "@/schema"
import { eq } from "drizzle-orm"

/**
 * 対象社員の直属上長の employee ID を解決する。
 * orgMemberships テーブルから managerEmployeeCode を取得し、
 * employees テーブルでコードから ID に変換する。
 *
 * 社員コードが未設定、上長が未設定、上長コードに対応する社員が見つからない場合は null を返す。
 */
export async function resolveDirectManagerId(
  c: Context,
  targetEmployeeId: number,
): Promise<number | null | Error> {
  try {
    // 対象社員のコードを取得
    const employeeRows = await c.var.database
      .select({ code: employees.code })
      .from(employees)
      .where(eq(employees.id, targetEmployeeId))
      .limit(1)

    const targetCode = employeeRows.at(0)?.code

    if (targetCode === undefined || targetCode === null) {
      return null
    }

    // orgMemberships から上長コードを取得
    const membershipRows = await c.var.database
      .select({ managerEmployeeCode: orgMemberships.managerEmployeeCode })
      .from(orgMemberships)
      .where(eq(orgMemberships.employeeCode, targetCode))
      .limit(1)

    const managerCode = membershipRows.at(0)?.managerEmployeeCode

    if (managerCode === undefined || managerCode === null) {
      return null
    }

    // 上長コードから employee ID を解決
    const managerRows = await c.var.database
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.code, managerCode))
      .limit(1)

    return managerRows.at(0)?.id ?? null
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve direct manager")
  }
}
