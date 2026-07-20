import { ArchiveMeeting } from "@/application/meeting/archive-meeting"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppMeeting } from "@/lib/app-schemas"

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
