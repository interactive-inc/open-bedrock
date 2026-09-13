import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { createExpensePreservationSubmissionHandlers } from "@/contexts/expense/interface/operations/create-expense-preservation-submission-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 本人の終了済み提案と元記録を確認し、新しい会社資格で次版を提出する
export const POST = expenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createExpensePreservationSubmissionHandlers("resubmit"),
)
