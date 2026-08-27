import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedShiftAssignment = {
  id: number
  employeeId: EmployeeId
  patternId: number | null
  date: string
  note: string | null
  publishedAt: string | null
}

/** publishedAt:null は下書き、文字列入りは公開済み。 */
export const seedShiftAssignments: ReadonlyArray<SeedShiftAssignment> = [
  {
    id: 1,
    employeeId: toWorkforceEmployeeId(5),
    patternId: 1,
    date: "2026-06-01",
    note: null,
    publishedAt: "2026-05-20T09:00:00Z",
  },
  {
    id: 2,
    employeeId: toWorkforceEmployeeId(5),
    patternId: 2,
    date: "2026-06-02",
    note: "研修",
    publishedAt: null,
  },
  {
    id: 3,
    employeeId: toWorkforceEmployeeId(4),
    patternId: 1,
    date: "2026-06-01",
    note: null,
    publishedAt: "2026-05-20T09:00:00Z",
  },
]
