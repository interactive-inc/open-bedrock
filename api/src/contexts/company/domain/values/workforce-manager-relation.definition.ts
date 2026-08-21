import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"

export type WorkforceManagerRelation = Readonly<{
  employeeId: EmployeeId
  managerEmployeeId: EmployeeId
}>
