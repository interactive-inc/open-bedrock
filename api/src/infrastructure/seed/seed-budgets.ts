type SeedBudget = {
  id: number
  fiscalYear: number
  departmentCode: string | null
  title: string
  amount: number
  note: string | null
  createdAt: string
}

export const seedBudgets: ReadonlyArray<SeedBudget> = [
  {
    id: 1,
    fiscalYear: 2026,
    departmentCode: "D001",
    title: "採用広報",
    amount: 1_000_000,
    note: null,
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: 2,
    fiscalYear: 2026,
    departmentCode: null,
    title: "全社ツール",
    amount: 500_000,
    note: null,
    createdAt: "2026-04-01T00:00:00Z",
  },
]

type SeedBudgetConsumption = {
  id: number
  budgetId: number
  amount: number
  note: string | null
  recordedOn: string
  createdAt: string
}

export const seedBudgetConsumptions: ReadonlyArray<SeedBudgetConsumption> = [
  {
    id: 1,
    budgetId: 1,
    amount: 300_000,
    note: "求人媒体",
    recordedOn: "2026-05-10",
    createdAt: "2026-05-10T00:00:00Z",
  },
]
