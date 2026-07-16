type SeedBudget = {
  id: number
  departmentId: number
  fiscalPeriod: string
  periodStart: string
  periodEnd: string
  amount: number
  name: string
  note: string | null
  createdAt: string
}

// departmentId は seedDepartments に存在する部署に対応させる。
// dept 3(Engineering)は seed-expenses の承認済み経費(id:2, 3300)が消化額に反映される。
export const seedBudgets: ReadonlyArray<SeedBudget> = [
  {
    id: 1,
    departmentId: 3,
    fiscalPeriod: "2026",
    periodStart: "2026-04-01",
    periodEnd: "2027-03-31",
    amount: 1_000_000,
    name: "Engineering FY2026",
    note: "annual operating budget",
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: 2,
    departmentId: 4,
    fiscalPeriod: "2026",
    periodStart: "2026-04-01",
    periodEnd: "2027-03-31",
    amount: 500_000,
    name: "Sales FY2026",
    note: null,
    createdAt: "2026-04-01T00:00:00Z",
  },
]
