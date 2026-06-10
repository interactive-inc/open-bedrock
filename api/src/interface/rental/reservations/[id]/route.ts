import { CancelRentalReservation } from "@/application/rental/cancel-rental-reservation"
import { GetRentalReservation } from "@/application/rental/get-rental-reservation"
import { UpdateRentalReservation } from "@/application/rental/update-rental-reservation"
import type { RentalReservation } from "@/domain/rental/rental-reservation"
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

function toResponseBody(r: RentalReservation) {
  return {
    id: r.id,
    requester_id: r.requesterId,
    item_name: r.itemName,
    start_date: r.startDate,
    end_date: r.endDate,
    purpose: r.purpose,
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
    throw new BadRequestError("invalid reservation id")
  }
  const r = await new GetRentalReservation(c).run({
    reservationId: id,
    requesterId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to load reservation")
  }
  if ("reason" in r) {
    if (r.reason === "reservation_not_found") {
      throw new NotFoundError("reservation not found")
    }
    throw new ForbiddenError("not the requester")
  }
  return c.json(toResponseBody(r), 200)
})
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        item_name: z.string().min(1).max(500),
        start_date: isoDate,
        end_date: isoDate,
        purpose: z.string().max(3_000).nullable().optional(),
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
      throw new BadRequestError("invalid reservation id")
    }
    const json = c.req.valid("json")
    const r = await new UpdateRentalReservation(c).run({
      reservationId: id,
      requesterId: viewer.employeeId,
      itemName: json.item_name,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose ?? null,
    })
    if (r instanceof Error) {
      throw new InternalError("failed to update reservation")
    }
    if ("reason" in r) {
      if (r.reason === "reservation_not_found") {
        throw new NotFoundError("reservation not found")
      }
      if (r.reason === "not_modifiable") {
        throw new ConflictError("reservation is not modifiable")
      }
      throw new ForbiddenError("not the requester")
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
    throw new BadRequestError("invalid reservation id")
  }
  const r = await new CancelRentalReservation(c).run({
    reservationId: id,
    requesterId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to cancel reservation")
  }
  if (r.reason === "reservation_not_found") {
    throw new NotFoundError("reservation not found")
  }
  if (r.reason === "not_requester") {
    throw new ForbiddenError("not the requester")
  }
  if (r.reason === "not_modifiable") {
    throw new ConflictError("reservation is not modifiable")
  }
  return c.body(null, 204)
})
