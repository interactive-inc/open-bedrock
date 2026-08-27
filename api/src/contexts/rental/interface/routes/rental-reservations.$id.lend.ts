import { LendRentalReservation } from "@/contexts/rental/application/lend-rental-reservation"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppRentalReservation } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /rental-reservations/:id/lend — 総務・人事が貸与品を貸出済みにする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new LendRentalReservation(c).execute({
    session: session,
    reservationId: validateUuidParam(c.req.param("id"), "rental reservation"),
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppRentalReservation.parse({
    id: updated.id,
    requester_id: updated.requesterId,
    item_name: updated.itemName,
    start_date: updated.startDate,
    end_date: updated.endDate,
    purpose: updated.purpose,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})
