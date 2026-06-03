import { CancelRentalReservation } from "@/application/rental/cancel-rental-reservation"
import { GetRentalReservation } from "@/application/rental/get-rental-reservation"
import { UpdateRentalReservation } from "@/application/rental/update-rental-reservation"
import type { RentalReservation } from "@/domain/rental/rental-reservation"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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
    reservationId: c.req.param("id") ?? "",
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
    z.object({
      item_name: z.string().min(1),
      start_date: z.string().min(1),
      end_date: z.string().min(1),
      purpose: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const reservation = await new UpdateRentalReservation(c).run({
      reservationId: c.req.param("id") ?? "",
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
    reservationId: c.req.param("id") ?? "",
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

  return c.body(null, 204)
})
