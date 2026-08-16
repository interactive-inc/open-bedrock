import { ArchiveAnnouncement } from "@/contexts/announcement/application/archive-announcement"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { zAppAnnouncement } from "@/lib/app-schemas"

// @authorization service - session を application service に渡して判定する
/** POST /announcements/:id/archive — アナウンスをアーカイブ（announcement:manage）。 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const archived = await new ArchiveAnnouncement(c).run({
    session: session,
    announcementId: validateIntParam(c.req.param("id"), "announcement"),
  })

  if (archived instanceof ApplicationError) {
    throw toHttpException(archived)
  }

  const responseBody = zAppAnnouncement.parse({
    id: archived.id,
    title: archived.title,
    body_md: archived.bodyMd,
    status: archived.status,
    published_on: archived.publishedOn,
    author_employee_id: archived.authorEmployeeId,
    created_at: archived.createdAt,
  })

  return c.json(responseBody, 200)
})
