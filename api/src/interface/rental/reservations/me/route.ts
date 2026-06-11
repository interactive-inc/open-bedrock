import { ListMyRentalReservations } from "@/application/rental/list-my-rental-reservations"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /rentals/me — 申請者本人のレンタル予約一覧
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

  const reservations = await new ListMyRentalReservations(c).run({
    requesterId: viewer.employeeId,
    limit,
    offset,
  })

  if (reservations instanceof Error) {
    throw new InternalError("failed to load reservations")
  }

  const responseBody = reservations.map((reservation) => ({
    id: reservation.id,
    requester_id: reservation.requesterId,
    item_name: reservation.itemName,
    start_date: reservation.startDate,
    end_date: reservation.endDate,
    purpose: reservation.purpose,
    status: reservation.status,
    created_at: reservation.createdAt,
  }))

  return c.json(responseBody, 200)
})
