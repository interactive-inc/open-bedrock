import type { ExpenseCategory } from "@/lib/schemas"

export type ExpenseInboxView = {
  id: number
  applicantName: string
  category: ExpenseCategory
  amount: number
  spentAt: string
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}
