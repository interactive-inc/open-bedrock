export type ExpenseInboxView = {
  id: number
  applicantName: string
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}
