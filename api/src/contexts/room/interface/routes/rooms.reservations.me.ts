import { UnexpectedError } from "@/lib/errors"
import { RoomReservationRepository } from "@/contexts/room/infrastructure/repositories/room-reservation.repository"

import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppRoomReservationList } from "@/lib/app-schemas"
import { roomReservations } from "@/contexts/room/infrastructure/schema/room"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /rooms/reservations/me — 予約者本人の会議室予約一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
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

  const reservations = await (async () => {
    const command = {
      reserverId: viewer.employeeId,
      limit,
      offset,
    }

    const reservationRepository = new RoomReservationRepository(c)

    const reservations = await reservationRepository.findByReserverId(command.reserverId, {
      limit: command.limit,
      offset: command.offset,
    })

    if (reservations instanceof Error) {
      return new UnexpectedError("failed to find reservations", { cause: reservations })
    }

    return reservations
  })()

  if (reservations instanceof ApplicationError) {
    throw toHttpException(reservations)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(roomReservations)
    .where(eq(roomReservations.reserverId, viewer.employeeId))

  const responseBody = zAppRoomReservationList.parse({
    data: reservations.map((reservation) => ({
      id: reservation.id,
      room_id: reservation.roomId,
      reserver_id: reservation.reserverId,
      start_at: reservation.startAt,
      end_at: reservation.endAt,
      purpose: reservation.purpose,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
