type SeedShiftSwapRequest = {
  id: number
  requesterEmployeeId: number
  targetEmployeeId: number
  date: string
  note: string | null
  status: string
  approvedAt: string | null
}

/** status は "pending" か "approved"。approvedAt は承認済みのみ文字列。 */
export const seedShiftSwapRequests: ReadonlyArray<SeedShiftSwapRequest> = [
  {
    id: 1,
    requesterEmployeeId: 5,
    targetEmployeeId: 4,
    date: "2026-06-01",
    note: "Medical appointment",
    status: "pending",
    approvedAt: null,
  },
  {
    id: 2,
    requesterEmployeeId: 4,
    targetEmployeeId: 5,
    date: "2026-06-03",
    note: null,
    status: "approved",
    approvedAt: "2026-05-22T10:00:00Z",
  },
]
