import { UnexpectedError } from "@/lib/errors"
import { RentalReservationRepository } from "@/contexts/rental/infrastructure/rental-reservation.repository"

import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppRentalReservationList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { rentalReservations } from "@/contexts/rental/infrastructure/schema/rental"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /rental-reservations/me — 申請者本人のレンタル予約一覧 */
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
      requesterId: viewer.employeeId,
      limit,
      offset,
    }

    const reservationRepository = new RentalReservationRepository(c)

    const reservations = await reservationRepository.findByRequesterId({
      requesterId: command.requesterId,
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
    .from(rentalReservations)
    .where(eq(rentalReservations.requesterId, viewer.employeeId))

  const responseBody = zAppRentalReservationList.parse({
    data: reservations.map((reservation) => ({
      id: reservation.id,
      requester_id: reservation.requesterId,
      item_name: reservation.itemName,
      start_date: reservation.startDate,
      end_date: reservation.endDate,
      purpose: reservation.purpose,
      status: reservation.status,
      created_at: reservation.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
