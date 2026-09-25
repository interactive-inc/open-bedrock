import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedExpenseApproval = {
  id: string
  expenseId: string
  approverId: EmployeeId
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

/** 初期状態では承認記録なし。 */
export const seedExpenseApprovals: ReadonlyArray<SeedExpenseApproval> = []
