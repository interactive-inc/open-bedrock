import { ApproveBusinessTrip } from "@/contexts/business-trip/application/approve-business-trip"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppBusinessTrip } from "@/contexts/business-trip/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /business-trips/:id/approve — 人事が出張申請を承認する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new ApproveBusinessTrip(c).execute({
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
