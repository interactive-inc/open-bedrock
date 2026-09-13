import { createExpensePreservationDecisionHandlers } from "@/contexts/expense/interface/operations/create-expense-preservation-decision-handlers"
import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = expenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createExpensePreservationDecisionHandlers("approve"),
)
