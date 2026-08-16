import { CreateMeeting } from "@/contexts/meeting/application/create-meeting"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppMeeting, zAppMeetingList } from "@/lib/app-schemas"
import { meetings } from "@/contexts/meeting/infrastructure/schema/meeting"
import { count, desc } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /meetings — 会議体一覧（全認証者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const [rows, totalRows] = await Promise.all([
    c.var.database.select().from(meetings).orderBy(desc(meetings.id)).limit(limit).offset(offset),
    c.var.database.select({ total: count() }).from(meetings),
  ])

  const responseBody = zAppMeetingList.parse({
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      cadence: row.cadence,
      description: row.description,
      status: row.status,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /meetings — 会議体を新規登録（meeting:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1).max(64),
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

    const json = c.req.valid("json")

    const created = await new CreateMeeting(c).run({
      session: session,
      code: json.code,
      name: json.name,
      cadence: json.cadence ?? null,
      description: json.description ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppMeeting.parse({
      id: created.id,
      code: created.code,
      name: created.name,
      cadence: created.cadence,
      description: created.description,
      status: created.status,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
