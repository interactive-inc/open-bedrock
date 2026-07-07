import { ArchiveRegulation } from "@/application/regulation/archive-regulation"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRegulation } from "@/lib/app-schemas"
import { validateCodeParam } from "@/interface/shared/validate-code-param"

// POST /regulations/:code/archive — 規程をアーカイブ（regulation:manage）。
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
