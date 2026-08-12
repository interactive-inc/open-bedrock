import type { Context } from "@/env"
import { employees } from "@/contexts/company/infrastructure/schema/employee"

/**
 * employees を全件読み、id → code の対応を作る。id 解決に失敗した従業員、および
 * 社員コードを持たない従業員（外部プロビジョニングで作られた code=null 行）は除く。
 */
export async function buildEmployeeCodeMap(c: Context): Promise<Map<number, string> | Error> {
  try {
    const rows = await c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)

    const codesById = new Map<number, string>()

    for (const row of rows) {
      if (row.code === null) continue
      codesById.set(row.id, row.code)
    }

    return codesById
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to load employees")
  }
}
