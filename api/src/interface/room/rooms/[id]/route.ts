import { DeleteRoom } from "@/application/room/delete-room"
import { GetRoom } from "@/application/room/get-room"
import { UpdateRoom } from "@/application/room/update-room"
import { Room } from "@/domain/room/room"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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

// :id を整数に変換する。数値でなければ null。
function toRoomId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)

  return Number.isInteger(parsed) ? parsed : null
}

// GET /rooms/:id — 会議室マスタの詳細（要ログイン、閲覧は全ロール）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const roomId = toRoomId(c.req.param("id") ?? "")

  if (roomId === null) {
    throw new BadRequestError("invalid room id")
  }

  const result = await new GetRoom(c).run({ roomId })

  if (result instanceof Error) {
    throw new InternalError("failed to load room")
  }

  if (result instanceof Room === false) {
    throw new NotFoundError("room not found")
  }

  return c.json(toResponseBody(result), 200)
})

// PUT /rooms/:id — 会議室の名称・定員・所在地を更新（管理者ロールのみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
      capacity: z.number().int().positive(),
      location: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const roomId = toRoomId(c.req.param("id") ?? "")

    if (roomId === null) {
      throw new BadRequestError("invalid room id")
    }

    const json = c.req.valid("json")

    const updated = await new UpdateRoom(c).run({
      viewerRole: session.role,
      roomId,
      details: { name: json.name, capacity: json.capacity, location: json.location ?? null },
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update room")
    }

    if (updated instanceof Room) {
      return c.json(toResponseBody(updated), 200)
    }

    if (updated.reason === "room_not_found") {
      throw new NotFoundError("room not found")
    }

    throw new ForbiddenError()
  },
)

// DELETE /rooms/:id — 会議室を削除（管理者ロールのみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const roomId = toRoomId(c.req.param("id") ?? "")

  if (roomId === null) {
    throw new BadRequestError("invalid room id")
  }

  const result = await new DeleteRoom(c).run({ viewerRole: session.role, roomId })

  if (result instanceof Error) {
    throw new InternalError("failed to delete room")
  }

  if (result.reason === "room_not_found") {
    throw new NotFoundError("room not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  return c.body(null, 204)
})
