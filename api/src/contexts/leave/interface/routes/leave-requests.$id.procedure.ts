import { zLeaveProcedureView } from "@/contexts/leave/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { LeaveProcedureReadAdapter } from "@/contexts/leave/infrastructure/adapters/leave-procedure-read.adapter"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 本人・閲覧権限・現在の判断資格を照合する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
  const view = await new LeaveProcedureReadAdapter(c).find({
    leaveRequestId: validateIntParam(c.req.param("id"), "leave request"),
    session: c.var.session,
    tokenVersion: c.var.accountTokenVersion,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (view instanceof ApplicationError) throw toHttpException(view)
  return c.json(zLeaveProcedureView.parse(view), 200)
})
