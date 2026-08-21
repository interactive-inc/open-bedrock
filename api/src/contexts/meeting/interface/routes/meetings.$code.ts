import { UpdateMeeting } from "@/contexts/meeting/application/update-meeting"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppMeeting } from "@/lib/app-schemas"
import { meetings } from "@/contexts/meeting/infrastructure/schema/meeting"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /meetings/:code — 会議体の詳細（全認証者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "meeting")

  const rows = await c.var.database.select().from(meetings).where(eq(meetings.code, code)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("meeting not found")
  }

  const responseBody = zAppMeeting.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    cadence: row.cadence,
    description: row.description,
    status: row.status,
    created_at: row.createdAt,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /meetings/:code — 会議体の名称・頻度・説明を更新（meeting:manage） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      cadence: z.string().max(200).nullable().optional(),
      description: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const code = validateCodeParam(c.req.param("code"), "meeting")

    const json = c.req.valid("json")

    const updated = await new UpdateMeeting(c).run({
      session: session,
      code: code,
      name: json.name,
      cadence: json.cadence ?? null,
      description: json.description ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppMeeting.parse({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      cadence: updated.cadence,
      description: updated.description,
      status: updated.status,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
