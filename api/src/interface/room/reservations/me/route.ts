import { ListMyRoomReservations } from "@/application/room/list-my-room-reservations"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /rooms/reservations/me — 予約者本人の会議室予約一覧
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

  const reservations = await new ListMyRoomReservations(c).run({
    reserverId: viewer.employeeId,
    limit,
    offset,
  })

  if (reservations instanceof Error) {
    throw new InternalError("failed to load reservations")
  }

  const responseBody = reservations.map((reservation) => ({
    id: reservation.id,
    room_id: reservation.roomId,
    reserver_id: reservation.reserverId,
    start_at: reservation.startAt,
    end_at: reservation.endAt,
    purpose: reservation.purpose,
  }))

  return c.json(responseBody, 200)
})
