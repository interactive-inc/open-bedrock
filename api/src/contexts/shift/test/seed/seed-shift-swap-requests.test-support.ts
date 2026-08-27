import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedShiftSwapRequest = {
  id: number
  requesterEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
  date: string
  note: string | null
  status: string
  approvedAt: string | null
}

/** status は "pending" か "approved"。approvedAt は承認済みのみ文字列。 */
export const seedShiftSwapRequests: ReadonlyArray<SeedShiftSwapRequest> = [
  {
    id: 1,
    requesterEmployeeId: toWorkforceEmployeeId(5),
    targetEmployeeId: toWorkforceEmployeeId(4),
    date: "2026-06-01",
    note: "通院のため",
    status: "pending",
    approvedAt: null,
  },
  {
    id: 2,
    requesterEmployeeId: toWorkforceEmployeeId(4),
    targetEmployeeId: toWorkforceEmployeeId(5),
    date: "2026-06-03",
    note: null,
    status: "approved",
    approvedAt: "2026-05-22T10:00:00Z",
  },
]
