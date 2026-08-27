import { RejectBusinessTrip } from "@/contexts/business-trip/application/reject-business-trip"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppBusinessTrip } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /business-trips/:id/reject — 人事が出張申請を却下する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new RejectBusinessTrip(c).execute({
    session: session,
    businessTripId: validateUuidParam(c.req.param("id"), "business trip"),
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppBusinessTrip.parse({
    id: updated.id,
    traveler_id: updated.travelerId,
    destination: updated.destination,
    start_date: updated.startDate,
    end_date: updated.endDate,
    purpose: updated.purpose,
    estimated_cost: updated.estimatedCost,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})
