import { ListRooms } from "@/application/room/list-rooms"
import { RegisterRoom } from "@/application/room/register-room"
import { Room } from "@/domain/room/room"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
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

  const result = await new ListRooms(c).run()

  if (result instanceof Error) {
    throw new InternalError("failed to load rooms")
  }

  return c.json(
    result.map((room) => toResponseBody(room)),
    200,
  )
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
