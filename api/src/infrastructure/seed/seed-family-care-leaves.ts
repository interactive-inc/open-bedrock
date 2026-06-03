type SeedFamilyCareLeave = {
  id: string
  employeeId: number
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
    employeeId: 2,
    leaveKind: "maternity",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    note: "産前産後の休業を申し出ます",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: 4,
    leaveKind: "childcare",
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    note: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: 9,
    leaveKind: "family_care",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    note: "家族の介護のため休業を申し出ます",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
