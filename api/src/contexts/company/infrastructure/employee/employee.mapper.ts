import { Employee } from "@/contexts/company/domain/employee/employee.entity"
import type { EmployeeRow } from "@/contexts/company/infrastructure/schema/employee"

type EmployeeProjection = Pick<
  EmployeeRow,
  "id" | "code" | "name" | "deptId" | "deptName" | "position" | "status" | "phone"
>

/** Drizzleの永続化表現をCompany Employeeへ復元するInfrastructure mapper。 */
export function restoreEmployee(row: EmployeeProjection): Employee {
  return Employee.restore({
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
