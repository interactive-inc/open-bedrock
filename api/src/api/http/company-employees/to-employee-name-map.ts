import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"

/** 社員 id の配列から id→氏名 の Map を作る。 */
export async function toEmployeeNameMap(
  c: Context,
  employeeIds: ReadonlyArray<EmployeeId>,
): Promise<ReadonlyMap<EmployeeId, string> | Error> {
  return CompanyEmployeeDirectoryReadAdapter.findNames({
    database: c.var.database,
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
    employeeIds,
  })
}
