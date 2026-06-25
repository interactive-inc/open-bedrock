import { DeleteRoom } from "@/application/room/delete-room"
import { GetRoom } from "@/application/room/get-room"
import { UpdateRoom } from "@/application/room/update-room"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { BadRequestError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRoom } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// :id を整数に変換する。数値でなければ null。
function toRoomId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppRoom.parse({
    id: result.id,
    name: result.name,
    capacity: result.capacity,
    location: result.location,
  })

  return c.json(responseBody, 200)
})

// PUT /rooms/:id — 会議室の名称・定員・所在地を更新（管理者ロールのみ）
export const PUT = factory.createHandlers(
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

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppRoom.parse({
      id: updated.id,
      name: updated.name,
      capacity: updated.capacity,
      location: updated.location,
    })

    return c.json(responseBody, 200)
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

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
