type SeedLeaveRequest = {
  id: number
  employeeId: number
  leaveType: "annual" | "special"
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: "pending" | "approved" | "rejected"
  approverId: number | null
  decidedComment: string | null
  createdAt: string
}

/** days は toLeaveDays(startDate, endDate) と一致する包括日数。pending は approverId/decidedComment を null に。 */
export const seedLeaveRequests: ReadonlyArray<SeedLeaveRequest> = [
  {
    id: 1,
    employeeId: 5,
    leaveType: "annual",
    startDate: "2026-06-01",
    endDate: "2026-06-03",
    days: 3,
    reason: "personal matters",
    status: "pending",
    approverId: null,
    decidedComment: null,
    createdAt: "2026-05-20T00:00:00Z",
  },
  {
    id: 2,
    employeeId: 10,
    leaveType: "special",
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    days: 1,
    reason: null,
    status: "approved",
    approverId: 4,
    decidedComment: "approved",
    createdAt: "2026-05-21T00:00:00Z",
  },
]
