import { ArchivePartner } from "@/contexts/partner/application/archive-partner"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /partners/:id/archive — 取引先をアーカイブ（partner:manage、物理削除はしない） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new ArchivePartner(c).run({
    session: session,
    id: validateIntParam(c.req.param("id"), "partner"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
