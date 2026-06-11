import { CancelRoomReservation } from "@/application/room/cancel-room-reservation"
import { GetRoomReservation } from "@/application/room/get-room-reservation"
import { UpdateRoomReservation } from "@/application/room/update-room-reservation"
import type { RoomReservation } from "@/domain/room/room-reservation"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/interface/lib/errors"
import { validateUuidParam } from "@/interface/shared/validate-uuid-param"
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
    reservationId: validateUuidParam(c.req.param("id"), "reservation"),
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
    z
      .object({
        start_at: z.string().datetime(),
        end_at: z.string().datetime(),
        purpose: z.string().max(3_000).nullable().optional(),
      })
      .refine((data) => data.end_at > data.start_at, {
        message: "end_at must be after start_at",
        path: ["end_at"],
      }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const reservation = await new UpdateRoomReservation(c).run({
      reservationId: validateUuidParam(c.req.param("id"), "reservation"),
      reserverId: viewer.employeeId,
      startAt: json.start_at,
      endAt: json.end_at,
      purpose: json.purpose ?? null,
    })

    if (reservation instanceof Error) {
      throw new InternalError("failed to update reservation")
    }

    if ("reason" in reservation) {
      if (reservation.reason === "invalid_time_range") {
        throw new BadRequestError("end_at must be after start_at")
      }

      if (reservation.reason === "start_in_past") {
        throw new UnprocessableEntityError("start_at must be in the future")
      }

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
    reservationId: validateUuidParam(c.req.param("id"), "reservation"),
    reserverId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel reservation")
  }

  if (result.reason === "reservation_not_found") {
    throw new NotFoundError("reservation not found")
  }

  return c.body(null, 204)
})
