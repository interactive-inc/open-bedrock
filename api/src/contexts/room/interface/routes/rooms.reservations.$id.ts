import { CancelRoomReservation } from "@/contexts/room/application/cancel-room-reservation"
import { GetRoomReservation } from "@/contexts/room/application/get-room-reservation"
import { UpdateRoomReservation } from "@/contexts/room/application/update-room-reservation"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppRoomReservation } from "@/lib/app-schemas"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /rooms/reservations/:id — 予約の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const reservation = await new GetRoomReservation(c).run({
    reservationId: validateUuidParam(c.req.param("id"), "reservation"),
    reserverId: viewer.employeeId,
  })

  if (reservation instanceof ApplicationError) {
    throw toHttpException(reservation)
  }

  const responseBody = zAppRoomReservation.parse({
    id: reservation.id,
    room_id: reservation.roomId,
    reserver_id: reservation.reserverId,
    start_at: reservation.startAt,
    end_at: reservation.endAt,
    purpose: reservation.purpose,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /rooms/reservations/:id — 予約の時刻と用途を変更（本人のみ） */
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

    if (reservation instanceof ApplicationError) {
      throw toHttpException(reservation)
    }

    const responseBody = zAppRoomReservation.parse({
      id: reservation.id,
      room_id: reservation.roomId,
      reserver_id: reservation.reserverId,
      start_at: reservation.startAt,
      end_at: reservation.endAt,
      purpose: reservation.purpose,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /rooms/reservations/:id — 予約をキャンセル（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelRoomReservation(c).run({
    reservationId: validateUuidParam(c.req.param("id"), "reservation"),
    reserverId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
