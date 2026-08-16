type SeedResignation = {
  id: string
  employeeId: number
  resignationDate: string
  lastWorkingDate: string | null
  reason: string | null
  status: string
  createdAt: string
}

export const seedResignations: ReadonlyArray<SeedResignation> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    employeeId: 2,
    resignationDate: "2026-09-30",
    lastWorkingDate: "2026-09-20",
    reason: "Career change",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: 4,
    resignationDate: "2026-10-31",
    lastWorkingDate: null,
    reason: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: 9,
    resignationDate: "2026-08-15",
    lastWorkingDate: "2026-08-08",
    reason: "Relocation",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
