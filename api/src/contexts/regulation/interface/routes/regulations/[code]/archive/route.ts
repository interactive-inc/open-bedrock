import { ArchiveRegulation } from "@/contexts/regulation/application/archive-regulation"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppRegulation } from "@/lib/app-schemas"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"

// @authorization service - session を application service に渡して判定する
/** POST /regulations/:code/archive — 規程をアーカイブ（regulation:manage）。 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const archived = await new ArchiveRegulation(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "regulation"),
  })

  if (archived instanceof ApplicationError) {
    throw toHttpException(archived)
  }

  const responseBody = zAppRegulation.parse({
    id: archived.id,
    code: archived.code,
    title: archived.title,
    category: archived.category,
    status: archived.status,
    created_at: archived.createdAt,
  })

  return c.json(responseBody, 200)
})
