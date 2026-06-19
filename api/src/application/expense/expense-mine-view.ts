import type { ExpenseCategory } from "@/lib/schemas"

export type ExpenseMineView = {
  id: number
  category: ExpenseCategory
  amount: number
  spentAt: string
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}
