import { UpdateAnnouncement } from "@/contexts/company/application/announcement/update-announcement"
import { factory } from "@/contexts/company/interface/utils/factory"
import { announcements } from "@/schema"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { zAppAnnouncement } from "@/lib/app-schemas"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /announcements/:id — アナウンス1件。published は全員、draft/archived は管理者のみ。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const announcementId = validateIntParam(c.req.param("id"), "announcement")

  const rows = await c.var.database
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("announcement not found")
  }

  if (row.status !== "published" && session.hasPermission("announcement:manage") === false) {
    throw new NotFoundError("announcement not found")
  }

  const responseBody = zAppAnnouncement.parse({
    id: row.id,
    title: row.title,
    body_md: row.bodyMd,
    status: row.status,
    published_on: row.publishedOn,
    author_employee_id: row.authorEmployeeId,
    created_at: row.createdAt,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /announcements/:id — 社内アナウンスの表題・本文を更新（announcement:manage）。 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      body_md: z.string().min(1).max(50_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateAnnouncement(c).run({
      session: session,
      announcementId: validateIntParam(c.req.param("id"), "announcement"),
      title: json.title,
      bodyMd: json.body_md,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppAnnouncement.parse({
      id: updated.id,
      title: updated.title,
      body_md: updated.bodyMd,
      status: updated.status,
      published_on: updated.publishedOn,
      author_employee_id: updated.authorEmployeeId,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
