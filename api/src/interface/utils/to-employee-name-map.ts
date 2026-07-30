import type { Context } from "@/env"
import { employees } from "@/schema"
import { inArray } from "drizzle-orm"

/** 社員 id の配列から id→氏名 の Map を作る。 */
export async function toEmployeeNameMap(
  c: Context,
  employeeIds: ReadonlyArray<number>,
): Promise<Map<number, string>> {
  const uniqueIds = Array.from(new Set(employeeIds))

  if (uniqueIds.length === 0) {
    return new Map()
  }

  const rows = await c.var.database
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(inArray(employees.id, uniqueIds))

  return new Map(rows.map((row) => [row.id, row.name]))
}
