import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedShiftAssignment = {
  id: string
  employeeId: EmployeeId
  patternId: string | null
  date: string
  note: string | null
  publishedAt: string | null
}

/** publishedAt:null は下書き、文字列入りは公開済み。 */
export const seedShiftAssignments: ReadonlyArray<SeedShiftAssignment> = [
  {
    id: "01900024-0000-7000-8000-000000000001",
    employeeId: toWorkforceEmployeeId(5),
    patternId: "01900023-0000-7000-8000-000000000001",
    date: "2026-06-01",
    note: null,
    publishedAt: "2026-05-20T09:00:00Z",
  },
  {
    id: "01900024-0000-7000-8000-000000000002",
    employeeId: toWorkforceEmployeeId(5),
    patternId: "01900023-0000-7000-8000-000000000002",
    date: "2026-06-02",
    note: "研修",
    publishedAt: null,
  },
  {
    id: "01900024-0000-7000-8000-000000000003",
    employeeId: toWorkforceEmployeeId(4),
    patternId: "01900023-0000-7000-8000-000000000001",
    date: "2026-06-01",
    note: null,
    publishedAt: "2026-05-20T09:00:00Z",
  },
]
