import { UpdateMeeting } from "@/application/meeting/update-meeting"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppMeeting } from "@/lib/app-schemas"
import { meetings } from "@/schema"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

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
