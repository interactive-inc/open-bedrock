import { ReturnRentalReservation } from "@/contexts/rental/application/return-rental-reservation"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppRentalReservation } from "@/contexts/rental/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /rental-reservations/:id/return — 総務・人事が貸与品を返却済みにする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new ReturnRentalReservation(c).execute({
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
