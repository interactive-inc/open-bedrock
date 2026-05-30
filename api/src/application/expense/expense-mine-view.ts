export type ExpenseMineView = {
  id: number
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}
