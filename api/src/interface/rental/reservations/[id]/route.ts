import { CancelRentalReservation } from "@/application/rental/cancel-rental-reservation"
import { GetRentalReservation } from "@/application/rental/get-rental-reservation"
import { UpdateRentalReservation } from "@/application/rental/update-rental-reservation"
import type { RentalReservation } from "@/domain/rental/rental-reservation"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateUuidParam } from "@/interface/shared/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 予約をレスポンス用の snake_case に整形する。
function toResponseBody(reservation: RentalReservation) {
  return {
    id: reservation.id,
    requester_id: reservation.requesterId,
    item_name: reservation.itemName,
    start_date: reservation.startDate,
    end_date: reservation.endDate,
    purpose: reservation.purpose,
    status: reservation.status,
    created_at: reservation.createdAt,
  }
}

// GET /rentals/:id — 予約の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const reservation = await new GetRentalReservation(c).run({
    reservationId: validateUuidParam(c.req.param("id"), "reservation"),
    requesterId: viewer.employeeId,
  })

  if (reservation instanceof Error) {
    throw new InternalError("failed to load reservation")
  }

  if ("reason" in reservation) {
    if (reservation.reason === "reservation_not_found") {
      throw new NotFoundError("reservation not found")
    }

    throw new ForbiddenError("not the requester")
  }

  return c.json(toResponseBody(reservation), 200)
})

// PUT /rentals/:id — 予約の品名・期間・用途を変更（本人のみ）
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

    const json = c.req.valid("json")

    const reservation = await new UpdateRentalReservation(c).run({
      reservationId: validateUuidParam(c.req.param("id"), "reservation"),
      requesterId: viewer.employeeId,
      itemName: json.item_name,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose ?? null,
    })

    if (reservation instanceof Error) {
      throw new InternalError("failed to update reservation")
    }

    if ("reason" in reservation) {
      if (reservation.reason === "reservation_not_found") {
        throw new NotFoundError("reservation not found")
      }

      if (reservation.reason === "invalid_date_range") {
        throw new BadRequestError("invalid date range")
      }

      if (reservation.reason === "overlapping_reservation") {
        throw new ConflictError("an overlapping rental reservation already exists")
      }

      if (reservation.reason === "not_modifiable") {
        throw new ConflictError("reservation is not modifiable")
      }

      throw new ForbiddenError("not the requester")
    }

    return c.json(toResponseBody(reservation), 200)
  },
)

// DELETE /rentals/:id — 予約を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelRentalReservation(c).run({
    reservationId: validateUuidParam(c.req.param("id"), "reservation"),
    requesterId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel reservation")
  }

  if (result.reason === "reservation_not_found") {
    throw new NotFoundError("reservation not found")
  }

  if (result.reason === "not_requester") {
    throw new ForbiddenError("not the requester")
  }

  if (result.reason === "not_modifiable") {
    throw new ConflictError("reservation is not modifiable")
  }

  return c.body(null, 204)
})
