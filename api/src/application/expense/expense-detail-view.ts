export type ExpenseDetailView = {
  id: number
  employeeId: number
  applicantName: string
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  note: string | null
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}
