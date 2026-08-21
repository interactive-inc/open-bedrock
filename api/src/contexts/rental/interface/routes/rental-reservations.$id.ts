import { ConflictError } from "@/lib/errors"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { RentalReservationRepository } from "@/contexts/rental/infrastructure/rental-reservation.repository"
import { UpdateRentalReservation } from "@/contexts/rental/application/update-rental-reservation"
import type { RentalReservation } from "@/contexts/rental/domain/entities/rental-reservation.entity"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/api/http/factory"
import { isoDate } from "@/lib/schemas"
import { zAppRentalReservation } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 予約をレスポンス用の snake_case に整形する。 */
function toResponseBody(reservation: RentalReservation) {
  return zAppRentalReservation.parse({
    id: reservation.id,
    requester_id: reservation.requesterId,
    item_name: reservation.itemName,
    start_date: reservation.startDate,
    end_date: reservation.endDate,
    purpose: reservation.purpose,
    status: reservation.status,
    created_at: reservation.createdAt,
  })
}

// @authorization owner - 本人のリソースに限定する
/** GET /rental-reservations/:id — 予約の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const reservation = await (async () => {
    const command = {
      reservationId: validateUuidParam(c.req.param("id"), "reservation"),
      requesterId: viewer.employeeId,
    }

    const reservationRepository = new RentalReservationRepository(c)

    const reservation = await reservationRepository.findById(command.reservationId)

    if (reservation instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: reservation })
    }

    if (reservation === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (reservation.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    return reservation
  })()

  if (reservation instanceof ApplicationError) {
    throw toHttpException(reservation)
  }

  return c.json(toResponseBody(reservation), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /rental-reservations/:id — 予約の品名・期間・用途を変更（本人のみ） */
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

    if (reservation instanceof ApplicationError) {
      throw toHttpException(reservation)
    }

    return c.json(toResponseBody(reservation), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /rental-reservations/:id — 予約を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await (async () => {
    const command = {
      reservationId: validateUuidParam(c.req.param("id"), "reservation"),
      requesterId: viewer.employeeId,
    }

    const reservationRepository = new RentalReservationRepository(c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("reservation is not modifiable", "not_modifiable")
    }

    const deleted = await reservationRepository.delete(command.reservationId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete reservation", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("reservation is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
