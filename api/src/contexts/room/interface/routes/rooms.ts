import { UnexpectedError } from "@/lib/errors"
import { RoomRepository } from "@/contexts/room/infrastructure/repositories/room.repository"

import { RegisterRoom } from "@/contexts/room/application/register-room"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppRoom, zAppRoomList } from "@/lib/app-schemas"
import { rooms } from "@/contexts/room/infrastructure/schema/room"
import { count } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /rooms — 会議室マスタ一覧（要ログイン、閲覧は全ロール） */
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

  const result = await (async () => {
    const props = { limit, offset }

    const roomRepository = new RoomRepository(c)

    const rooms = await roomRepository.findAll({ limit: props.limit, offset: props.offset })

    if (rooms instanceof Error) {
      return new UnexpectedError("failed to find rooms", { cause: rooms })
    }

    return rooms
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const totalRows = await c.var.database.select({ total: count() }).from(rooms)

  const responseBody = zAppRoomList.parse({
    data: result.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      location: room.location,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /rooms — 会議室を新規登録（管理者ロールのみ） */
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
      session: session,
      room: { name: json.name, capacity: json.capacity, location: json.location ?? null },
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppRoom.parse({
      id: created.id,
      name: created.name,
      capacity: created.capacity,
      location: created.location,
    })

    return c.json(responseBody, 201)
  },
)
