import type { ExpenseCategory, ExpenseStatus } from "@/lib/schemas"

export type ExpenseDetailView = {
  id: number
  employeeId: number
  applicantName: string
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  status: ExpenseStatus
  createdAt: string
}
