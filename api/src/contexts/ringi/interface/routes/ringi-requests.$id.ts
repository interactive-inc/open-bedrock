import { zRingiProcedureView } from "@/contexts/ringi/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { RingiProcedureReadAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-procedure-read.adapter"

// @authorization service - 本人・閲覧権限・現在の判断資格から参照範囲を制限する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
  const view = await new RingiProcedureReadAdapter(c).find({
    ringiId: validateIntParam(c.req.param("id"), "ringi"),
    session,
    tokenVersion: c.var.accountTokenVersion,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (view instanceof ApplicationError) throw toHttpException(view)
  return c.json(zRingiProcedureView.parse(view), 200)
})
