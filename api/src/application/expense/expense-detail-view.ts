import type { ExpenseCategory } from "@/lib/schemas"

export type ExpenseDetailView = {
  id: number
  employeeId: number
  applicantName: string
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}
