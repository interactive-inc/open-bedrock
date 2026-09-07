import { zExpenseProcedureView } from "@/contexts/expense/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { ExpenseProcedureReadAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-read.adapter"

// @authorization service - 本人・閲覧権限・現在の判断資格から参照範囲を制限する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
  const view = await new ExpenseProcedureReadAdapter(c).find({
    expenseId: validateIntParam(c.req.param("id"), "expense"),
    session,
    tokenVersion: c.var.accountTokenVersion,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (view instanceof ApplicationError) throw toHttpException(view)
  return c.json(zExpenseProcedureView.parse(view), 200)
})
