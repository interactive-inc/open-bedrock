import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedSalaryRevision = {
  id: number
  employeeId: EmployeeId
  effectiveDate: string
  previousBaseSalary: number
  newBaseSalary: number
  reason: string | null
  createdAt: string
}

export const seedSalaryRevisions: ReadonlyArray<SeedSalaryRevision> = [
  {
    id: 1,
    employeeId: toWorkforceEmployeeId(5),
    effectiveDate: "2025-04-01",
    previousBaseSalary: 280000,
    newBaseSalary: 300000,
    reason: "annual_raise",
    createdAt: "2025-03-20T00:00:00Z",
  },
  {
    id: 2,
    employeeId: toWorkforceEmployeeId(1),
    effectiveDate: "2025-04-01",
    previousBaseSalary: 260000,
    newBaseSalary: 280000,
    reason: null,
    createdAt: "2025-03-20T00:00:00Z",
  },
]
