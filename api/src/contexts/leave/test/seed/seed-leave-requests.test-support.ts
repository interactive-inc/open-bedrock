import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedLeaveRequest = {
  id: number
  employeeId: EmployeeId
  leaveType: "annual" | "special"
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: "pending" | "approved" | "rejected"
  approverId: EmployeeId | null
  decidedComment: string | null
  createdAt: string
}

/** days は toLeaveDays(startDate, endDate) と一致する包括日数。pending は approverId/decidedComment を null に。 */
export const seedLeaveRequests: ReadonlyArray<SeedLeaveRequest> = [
  {
    id: 1,
    employeeId: toWorkforceEmployeeId(5),
    leaveType: "annual",
    startDate: "2026-06-01",
    endDate: "2026-06-03",
    days: 3,
    reason: "私用のため",
    status: "pending",
    approverId: null,
    decidedComment: null,
    createdAt: "2026-05-20T00:00:00Z",
  },
  {
    id: 2,
    employeeId: toWorkforceEmployeeId(10),
    leaveType: "special",
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    days: 1,
    reason: null,
    status: "approved",
    approverId: toWorkforceEmployeeId(4),
    decidedComment: "承認しました",
    createdAt: "2026-05-21T00:00:00Z",
  },
]
