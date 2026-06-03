type SeedYearEndAdjustment = {
  id: string
  employeeId: number
  targetYear: number
  note: string | null
  status: string
  createdAt: string
}

export const seedYearEndAdjustments: ReadonlyArray<SeedYearEndAdjustment> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    employeeId: 2,
    targetYear: 2025,
    note: "Submitted with dependent deduction documents",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: 4,
    targetYear: 2025,
    note: null,
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: 9,
    targetYear: 2024,
    note: "Resubmission after address change",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
