type SeedExpense = {
  id: number
  employeeId: number
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  note: string | null
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}

/** employeeId は seedEmployees に存在する社員に対応させる。 */
export const seedExpenses: ReadonlyArray<SeedExpense> = [
  {
    id: 1,
    employeeId: 5,
    category: "transport",
    amount: 1200,
    spentAt: "2026-05-10",
    note: "client visit",
    status: "pending",
    createdAt: "2026-05-11T01:00:00Z",
  },
  {
    id: 2,
    employeeId: 5,
    category: "books",
    amount: 3300,
    spentAt: "2026-05-12",
    note: null,
    status: "approved",
    createdAt: "2026-05-13T02:00:00Z",
  },
  {
    id: 3,
    employeeId: 10,
    category: "entertainment",
    amount: 8800,
    spentAt: "2026-05-14",
    note: "team dinner",
    status: "pending",
    createdAt: "2026-05-15T03:00:00Z",
  },
]
