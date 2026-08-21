import { EmployeeDirectoryEntryValue } from "@/contexts/company/domain/values/employee-directory-entry.value"
import type { EmployeeRow } from "@/contexts/company/infrastructure/schema/employee"

type EmployeeProjection = Pick<
  EmployeeRow,
  "id" | "code" | "name" | "deptId" | "deptName" | "position" | "status" | "phone"
>

/** Drizzleの永続化表現をCompany EmployeeDirectoryEntryValueへ復元するInfrastructure mapper。 */
export function restoreEmployee(row: EmployeeProjection): EmployeeDirectoryEntryValue {
  return EmployeeDirectoryEntryValue.restore({
    id: row.id,
    code: row.code,
    name: row.name,
    deptId: row.deptId,
    deptName: row.deptName,
    position: row.position,
    status: row.status,
    phone: row.phone,
  })
}
