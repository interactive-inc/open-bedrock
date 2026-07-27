import { AdvanceRentalReservation } from "@/application/rental/advance-rental-reservation"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppRentalReservation } from "@/lib/app-schemas"
import { factory } from "@/interface/utils/factory"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"

/** POST /rental-reservations/:id/return — 総務・人事が貸与品を返却済みにする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceRentalReservation(c).run({
    session: session,
    reservationId: validateUuidParam(c.req.param("id"), "rental reservation"),
    action: "return",
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
