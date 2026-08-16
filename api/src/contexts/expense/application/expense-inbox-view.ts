import type { ExpenseCategory, ExpenseStatus } from "@/lib/schemas"

export type ExpenseInboxView = {
  id: number
  applicantName: string
  category: ExpenseCategory
  amount: number
  spentAt: string
  status: ExpenseStatus
  createdAt: string
}
