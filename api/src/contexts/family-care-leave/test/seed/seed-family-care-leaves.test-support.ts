import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedFamilyCareLeave = {
  id: string
  employeeId: EmployeeId
  leaveKind: string
  startDate: string
  endDate: string
  note: string | null
  status: string
  createdAt: string
}

export const seedFamilyCareLeaves: ReadonlyArray<SeedFamilyCareLeave> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    employeeId: toWorkforceEmployeeId(2),
    leaveKind: "maternity",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    note: "産前産後の休業を申し出ます",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: toWorkforceEmployeeId(4),
    leaveKind: "childcare",
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    note: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: toWorkforceEmployeeId(9),
    leaveKind: "family_care",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    note: "家族の介護のため休業を申し出ます",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
