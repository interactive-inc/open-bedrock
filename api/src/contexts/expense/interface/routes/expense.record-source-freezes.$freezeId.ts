import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { createExpenseSourceFreezeReadHandlers } from "@/contexts/expense/interface/operations/create-expense-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = expenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createExpenseSourceFreezeReadHandlers(),
)
