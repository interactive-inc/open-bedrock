import type { ExpenseCategory, ExpenseStatus } from "@/lib/schemas"

export type ExpenseMineView = {
  id: number
  category: ExpenseCategory
  amount: number
  spentAt: string
  status: ExpenseStatus
  createdAt: string
}
