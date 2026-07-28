import { CancelBusinessTrip } from "@/application/business-trip/cancel-business-trip"
import { GetBusinessTrip } from "@/application/business-trip/get-business-trip"
import { UpdateBusinessTrip } from "@/application/business-trip/update-business-trip"
import type { BusinessTrip } from "@/domain/business-trip/business-trip.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppBusinessTrip } from "@/lib/app-schemas"
import type { AppBusinessTrip } from "@/lib/app-schemas"
import { factory } from "@/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 出張申請をレスポンス用の snake_case に整形し、スキーマで検証する。 */
function toResponseBody(businessTrip: BusinessTrip): AppBusinessTrip {
  return zAppBusinessTrip.parse({
    id: businessTrip.id,
    traveler_id: businessTrip.travelerId,
    destination: businessTrip.destination,
    start_date: businessTrip.startDate,
    end_date: businessTrip.endDate,
    purpose: businessTrip.purpose,
    estimated_cost: businessTrip.estimatedCost,
    status: businessTrip.status,
    created_at: businessTrip.createdAt,
  })
}

/** GET /business-trips/:id — 出張申請の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const businessTrip = await new GetBusinessTrip(c).run({
    businessTripId: validateUuidParam(c.req.param("id"), "business trip"),
    travelerId: viewer.employeeId,
  })

  if (businessTrip instanceof ApplicationError) {
    throw toHttpException(businessTrip)
  }

  return c.json(toResponseBody(businessTrip), 200)
})

/** PUT /business-trips/:id — 出張申請の内容を変更（本人のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        destination: z.string().min(1).max(500),
        start_date: isoDate,
        end_date: isoDate,
        purpose: z.string().min(1).max(3_000),
        estimated_cost: z.number().int().nonnegative().nullable().optional(),
      })
      .refine((d) => d.start_date <= d.end_date, {
        message: "end_date must be on or after start_date",
        path: ["end_date"],
      }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const businessTrip = await new UpdateBusinessTrip(c).run({
      businessTripId: validateUuidParam(c.req.param("id"), "business trip"),
      travelerId: viewer.employeeId,
      destination: json.destination,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose,
      estimatedCost: json.estimated_cost ?? null,
    })

    if (businessTrip instanceof ApplicationError) {
      throw toHttpException(businessTrip)
    }

    return c.json(toResponseBody(businessTrip), 200)
  },
)

/** DELETE /business-trips/:id — 出張申請を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelBusinessTrip(c).run({
    businessTripId: validateUuidParam(c.req.param("id"), "business trip"),
    travelerId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
