import { PublishAnnouncement } from "@/contexts/announcement/application/publish-announcement"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { zAppAnnouncement } from "@/lib/app-schemas"

// @authorization service - session を application service に渡して判定する
/** POST /announcements/:id/publish — アナウンスを公開し全社へ通知（announcement:manage）。 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const now = c.env.NOW ?? new Date().toISOString()

  const published = await new PublishAnnouncement(c).run({
    session: session,
    announcementId: validateIntParam(c.req.param("id"), "announcement"),
    publishedOn: now.slice(0, 10),
    createdAt: now,
  })

  if (published instanceof ApplicationError) {
    throw toHttpException(published)
  }

  const responseBody = zAppAnnouncement.parse({
    id: published.id,
    title: published.title,
    body_md: published.bodyMd,
    status: published.status,
    published_on: published.publishedOn,
    author_employee_id: published.authorEmployeeId,
    created_at: published.createdAt,
  })

  return c.json(responseBody, 200)
})
