import { ListMyBusinessTrips } from "@/application/business-trip/list-my-business-trips"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { businessTrips } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /business-trips/me — 申請者本人の出張申請一覧
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

  const businessTripRows = await new ListMyBusinessTrips(c).run({
    travelerId: viewer.employeeId,
    limit,
    offset,
  })

  if (businessTripRows instanceof Error) {
    throw new InternalError("failed to load business trips")
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(businessTrips)
    .where(eq(businessTrips.travelerId, viewer.employeeId))

  const responseBody = businessTripRows.map((businessTrip) => ({
    id: businessTrip.id,
    traveler_id: businessTrip.travelerId,
    destination: businessTrip.destination,
    start_date: businessTrip.startDate,
    end_date: businessTrip.endDate,
    purpose: businessTrip.purpose,
    estimated_cost: businessTrip.estimatedCost,
    status: businessTrip.status,
    created_at: businessTrip.createdAt,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
