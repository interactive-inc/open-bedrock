import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export type WorkforceManagerRelation = Readonly<{
  employeeId: EmployeeId
  managerEmployeeId: EmployeeId
}>
