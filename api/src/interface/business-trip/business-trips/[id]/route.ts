import { CancelBusinessTrip } from "@/application/business-trip/cancel-business-trip"
import { GetBusinessTrip } from "@/application/business-trip/get-business-trip"
import { UpdateBusinessTrip } from "@/application/business-trip/update-business-trip"
import type { BusinessTrip } from "@/domain/business-trip/business-trip"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toResourceId } from "@/interface/shared/to-resource-id"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

function toResponseBody(r: BusinessTrip) {
  return {
    id: r.id,
    traveler_id: r.travelerId,
    destination: r.destination,
    start_date: r.startDate,
    end_date: r.endDate,
    purpose: r.purpose,
    estimated_cost: r.estimatedCost,
    status: r.status,
    created_at: r.createdAt,
  }
}

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session
  if (viewer === null) {
    throw new UnauthorizedError()
  }
  const id = toResourceId(c.req.param("id") ?? "")
  if (id === null) {
    throw new BadRequestError("invalid business trip id")
  }
  const r = await new GetBusinessTrip(c).run({ businessTripId: id, travelerId: viewer.employeeId })
  if (r instanceof Error) {
    throw new InternalError("failed to load business trip")
  }
  if ("reason" in r) {
    if (r.reason === "business_trip_not_found") {
      throw new NotFoundError("business trip not found")
    }
    throw new ForbiddenError("not the traveler")
  }
  return c.json(toResponseBody(r), 200)
})
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
    const id = toResourceId(c.req.param("id") ?? "")
    if (id === null) {
      throw new BadRequestError("invalid business trip id")
    }
    const json = c.req.valid("json")
    const r = await new UpdateBusinessTrip(c).run({
      businessTripId: id,
      travelerId: viewer.employeeId,
      destination: json.destination,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose,
      estimatedCost: json.estimated_cost ?? null,
    })
    if (r instanceof Error) {
      throw new InternalError("failed to update business trip")
    }
    if ("reason" in r) {
      if (r.reason === "business_trip_not_found") {
        throw new NotFoundError("business trip not found")
      }
      if (r.reason === "not_modifiable") {
        throw new ConflictError("not modifiable")
      }
      if (r.reason === "overlapping_trip") {
        throw new ConflictError("overlapping business trip already exists")
      }
      throw new ForbiddenError("not the traveler")
    }
    return c.json(toResponseBody(r), 200)
  },
)
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session
  if (viewer === null) {
    throw new UnauthorizedError()
  }
  const id = toResourceId(c.req.param("id") ?? "")
  if (id === null) {
    throw new BadRequestError("invalid business trip id")
  }
  const r = await new CancelBusinessTrip(c).run({
    businessTripId: id,
    travelerId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to cancel business trip")
  }
  if (r.reason === "business_trip_not_found") {
    throw new NotFoundError("business trip not found")
  }
  if (r.reason === "not_traveler") {
    throw new ForbiddenError("not the traveler")
  }
  if (r.reason === "not_modifiable") {
    throw new ConflictError("not modifiable")
  }
  return c.body(null, 204)
})
