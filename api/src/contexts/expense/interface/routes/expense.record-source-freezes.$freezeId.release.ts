import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { createExpenseSourceFreezeHandlers } from "@/contexts/expense/interface/operations/create-expense-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = expenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createExpenseSourceFreezeHandlers("release"),
)
