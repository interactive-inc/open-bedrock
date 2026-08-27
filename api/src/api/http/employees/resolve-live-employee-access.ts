import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"

export function resolveLiveEmployeeAccess(c: CompanyContext, employeeId: EmployeeId) {
  return new ResolveLiveEmployeeAccessAdapter(c).resolveLiveEmployeeAccess(employeeId)
}
