import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { createExpensePreservationSubmissionHandlers } from "@/contexts/expense/interface/operations/create-expense-preservation-submission-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の経費閲覧・保全権限とCompanyの判断候補を保存時にも検査する
export const POST = expenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createExpensePreservationSubmissionHandlers("create"),
)
