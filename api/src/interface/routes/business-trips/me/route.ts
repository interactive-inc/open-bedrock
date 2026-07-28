import { ListMyBusinessTrips } from "@/application/business-trip/list-my-business-trips"
import { ApplicationError } from "@/lib/errors"
import { zAppBusinessTripList } from "@/lib/app-schemas"
import { factory } from "@/interface/utils/factory"
import { toHttpException } from "@/interface/lib/to-http-exception"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { businessTrips } from "@/schema"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /business-trips/me — 申請者本人の出張申請一覧 */
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

  if (businessTripRows instanceof ApplicationError) {
    throw toHttpException(businessTripRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(businessTrips)
    .where(eq(businessTrips.travelerId, viewer.employeeId))

  const responseBody = zAppBusinessTripList.parse({
    data: businessTripRows.map((businessTrip) => ({
      id: businessTrip.id,
      traveler_id: businessTrip.travelerId,
      destination: businessTrip.destination,
      start_date: businessTrip.startDate,
      end_date: businessTrip.endDate,
      purpose: businessTrip.purpose,
      estimated_cost: businessTrip.estimatedCost,
      status: businessTrip.status,
      created_at: businessTrip.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
