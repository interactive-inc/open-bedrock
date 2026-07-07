import { AdvanceBusinessTrip } from "@/application/business-trip/advance-business-trip"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppBusinessTrip } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import { validateUuidParam } from "@/interface/shared/validate-uuid-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"

// POST /business-trips/:id/reject — 人事が出張申請を却下する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceBusinessTrip(c).run({
    session: session,
    businessTripId: validateUuidParam(c.req.param("id"), "business trip"),
    action: "reject",
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
