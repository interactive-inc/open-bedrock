import { CancelRoomReservation } from "@/application/room/cancel-room-reservation"
import { GetRoomReservation } from "@/application/room/get-room-reservation"
import { UpdateRoomReservation } from "@/application/room/update-room-reservation"
import type { RoomReservation } from "@/domain/room/room-reservation"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 予約をレスポンス用の snake_case に整形する。
function toResponseBody(reservation: RoomReservation) {
  return {
    id: reservation.id,
    room_id: reservation.roomId,
    reserver_id: reservation.reserverId,
    start_at: reservation.startAt,
    end_at: reservation.endAt,
    purpose: reservation.purpose,
  }
}

// GET /rooms/reservations/:id — 予約の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const reservation = await new GetRoomReservation(c).run({
    reservationId: c.req.param("id") ?? "",
    reserverId: viewer.employeeId,
  })

  if (reservation instanceof Error) {
    throw new InternalError("failed to load reservation")
  }

  if ("reason" in reservation) {
    if (reservation.reason === "reservation_not_found") {
      throw new NotFoundError("reservation not found")
    }

    throw new ForbiddenError("not the reserver")
  }

  return c.json(toResponseBody(reservation), 200)
})

// PUT /rooms/reservations/:id — 予約の時刻と用途を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      start_at: z.string().min(1),
      end_at: z.string().min(1),
      purpose: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const reservation = await new UpdateRoomReservation(c).run({
      reservationId: c.req.param("id") ?? "",
      reserverId: viewer.employeeId,
      startAt: json.start_at,
      endAt: json.end_at,
      purpose: json.purpose ?? null,
    })

    if (reservation instanceof Error) {
      throw new InternalError("failed to update reservation")
    }

    if ("reason" in reservation) {
      if (reservation.reason === "reservation_not_found") {
        throw new NotFoundError("reservation not found")
      }

      if (reservation.reason === "not_reserver") {
        throw new ForbiddenError("not the reserver")
      }

      throw new ConflictError("the room is already reserved")
    }

    return c.json(toResponseBody(reservation), 200)
  },
)

// DELETE /rooms/reservations/:id — 予約をキャンセル（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelRoomReservation(c).run({
    reservationId: c.req.param("id") ?? "",
    reserverId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel reservation")
  }

  if (result.reason === "reservation_not_found") {
    throw new NotFoundError("reservation not found")
  }

  if (result.reason === "not_reserver") {
    throw new ForbiddenError("not the reserver")
  }

  return c.body(null, 204)
})
