import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedResignation = {
  id: string
  employeeId: EmployeeId
  resignationDate: string
  lastWorkingDate: string | null
  reason: string | null
  status: string
  createdAt: string
}

export const seedResignations: ReadonlyArray<SeedResignation> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    employeeId: toWorkforceEmployeeId(2),
    resignationDate: "2026-09-30",
    lastWorkingDate: "2026-09-20",
    reason: "Career change",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: toWorkforceEmployeeId(4),
    resignationDate: "2026-10-31",
    lastWorkingDate: null,
    reason: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: toWorkforceEmployeeId(9),
    resignationDate: "2026-08-15",
    lastWorkingDate: "2026-08-08",
    reason: "Relocation",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
