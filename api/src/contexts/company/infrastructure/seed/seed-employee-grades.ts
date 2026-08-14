type SeedEmployeeGrade = {
  id: number
  employeeId: number
  gradeId: number
  effectiveDate: string
  reason: string | null
  createdAt: string
}

export const seedEmployeeGrades: ReadonlyArray<SeedEmployeeGrade> = [
  {
    id: 1,
    employeeId: 5,
    gradeId: 2,
    effectiveDate: "2025-04-01",
    reason: "初回設定",
    createdAt: "2025-04-01T00:00:00.000Z",
  },
  {
    id: 2,
    employeeId: 5,
    gradeId: 3,
    effectiveDate: "2026-04-01",
    reason: "昇格",
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: 3,
    employeeId: 9,
    gradeId: 1,
    effectiveDate: "2025-04-01",
    reason: null,
    createdAt: "2025-04-01T00:00:00.000Z",
  },
]
