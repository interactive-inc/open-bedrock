import { ArchiveMeeting } from "@/contexts/meeting/application/archive-meeting"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppMeeting } from "@/lib/app-schemas"

// @authorization service - session を application service に渡して判定する
/** POST /meetings/:code/archive — 会議体をアーカイブする（meeting:manage） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "meeting")

  const archived = await new ArchiveMeeting(c).run({ session: session, code: code })

  if (archived instanceof ApplicationError) {
    throw toHttpException(archived)
  }

  const responseBody = zAppMeeting.parse({
    id: archived.id,
    code: archived.code,
    name: archived.name,
    cadence: archived.cadence,
    description: archived.description,
    status: archived.status,
    created_at: archived.createdAt,
  })

  return c.json(responseBody, 200)
})
