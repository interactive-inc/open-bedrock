import { CancelBusinessTrip } from "@/application/business-trip/cancel-business-trip"
import { GetBusinessTrip } from "@/application/business-trip/get-business-trip"
import { UpdateBusinessTrip } from "@/application/business-trip/update-business-trip"
import type { BusinessTrip } from "@/domain/business-trip/business-trip"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 出張申請をレスポンス用の snake_case に整形する。
function toResponseBody(businessTrip: BusinessTrip) {
  return {
    id: businessTrip.id,
    traveler_id: businessTrip.travelerId,
    destination: businessTrip.destination,
    start_date: businessTrip.startDate,
    end_date: businessTrip.endDate,
    purpose: businessTrip.purpose,
    estimated_cost: businessTrip.estimatedCost,
    status: businessTrip.status,
    created_at: businessTrip.createdAt,
  }
}

// GET /business-trips/:id — 出張申請の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const businessTrip = await new GetBusinessTrip(c).run({
    businessTripId: c.req.param("id") ?? "",
    travelerId: viewer.employeeId,
  })

  if (businessTrip instanceof Error) {
    throw new InternalError("failed to load business trip")
  }

  if ("reason" in businessTrip) {
    if (businessTrip.reason === "business_trip_not_found") {
      throw new NotFoundError("business trip not found")
    }

    throw new ForbiddenError("not the traveler")
  }

  return c.json(toResponseBody(businessTrip), 200)
})

// PUT /business-trips/:id — 出張申請の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      destination: z.string().min(1).max(500),
      start_date: isoDate,
      end_date: isoDate,
      purpose: z.string().min(1).max(3_000),
      estimated_cost: z.number().int().nonnegative().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const businessTrip = await new UpdateBusinessTrip(c).run({
      businessTripId: c.req.param("id") ?? "",
      travelerId: viewer.employeeId,
      destination: json.destination,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose,
      estimatedCost: json.estimated_cost ?? null,
    })

    if (businessTrip instanceof Error) {
      throw new InternalError("failed to update business trip")
    }

    if ("reason" in businessTrip) {
      if (businessTrip.reason === "business_trip_not_found") {
        throw new NotFoundError("business trip not found")
      }

      throw new ForbiddenError("not the traveler")
    }

    return c.json(toResponseBody(businessTrip), 200)
  },
)

// DELETE /business-trips/:id — 出張申請を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelBusinessTrip(c).run({
    businessTripId: c.req.param("id") ?? "",
    travelerId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel business trip")
  }

  if (result.reason === "business_trip_not_found") {
    throw new NotFoundError("business trip not found")
  }

  if (result.reason === "not_traveler") {
    throw new ForbiddenError("not the traveler")
  }

  return c.body(null, 204)
})
