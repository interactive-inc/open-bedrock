import { ListMyRoomReservations } from "@/contexts/company/application/room/list-my-room-reservations"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppRoomReservationList } from "@/lib/app-schemas"
import { roomReservations } from "@/schema"
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

  const reservations = await new ListMyRoomReservations(c).run({
    reserverId: viewer.employeeId,
    limit,
    offset,
  })

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
