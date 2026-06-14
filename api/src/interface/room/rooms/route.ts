import { ListRooms } from "@/application/room/list-rooms"
import { RegisterRoom } from "@/application/room/register-room"
import { Room } from "@/domain/room/room.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { rooms } from "@/schema"
import { count } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 会議室をレスポンス用の snake_case に整形する。
function toResponseBody(room: Room) {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    location: room.location,
  }
}

// GET /rooms — 会議室マスタ一覧（要ログイン、閲覧は全ロール）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
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

  const result = await new ListRooms(c).run({ limit, offset })

  if (result instanceof Error) {
    throw new InternalError("failed to load rooms")
  }

  const totalRows = await c.var.database.select({ total: count() }).from(rooms)

  const responseBody = result.map((room) => toResponseBody(room))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})

// POST /rooms — 会議室を新規登録（管理者ロールのみ）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      capacity: z.number().int().positive(),
      location: z.string().max(500).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterRoom(c).run({
      viewerRole: session.role,
      room: { name: json.name, capacity: json.capacity, location: json.location ?? null },
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create room")
    }

    if (created instanceof Room === false) {
      throw new ForbiddenError()
    }

    return c.json(toResponseBody(created), 201)
  },
)
