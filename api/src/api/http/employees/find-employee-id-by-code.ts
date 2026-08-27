import { employees } from "@/contexts/company/infrastructure/schema/employee"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { eq } from "drizzle-orm"

/** 委任先のCompany Employee IDをcodeから解決する。 */
export async function findEmployeeIdByCode(
  context: Context,
  employeeCode: string,
): Promise<EmployeeId | null> {
  const row = await context.var.database
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.employeeCode, employeeCode))
    .limit(1)
    .then((rows) => rows.at(0))

  return row?.id ?? null
}
