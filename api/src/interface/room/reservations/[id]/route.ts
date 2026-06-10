import { CancelRoomReservation } from "@/application/room/cancel-room-reservation"
import { GetRoomReservation } from "@/application/room/get-room-reservation"
import { UpdateRoomReservation } from "@/application/room/update-room-reservation"
import type { RoomReservation } from "@/domain/room/room-reservation"
import { factory } from "@/lib/factory"
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

function toResponseBody(r: RoomReservation) {
  return {
    id: r.id,
    room_id: r.roomId,
    reserver_id: r.reserverId,
    start_at: r.startAt,
    end_at: r.endAt,
    purpose: r.purpose,
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
  const r = await new GetRoomReservation(c).run({
    reservationId: id,
    reserverId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to load reservation")
  }
  if ("reason" in r) {
    if (r.reason === "reservation_not_found") {
      throw new NotFoundError("reservation not found")
    }
    throw new ForbiddenError("not the reserver")
  }
  return c.json(toResponseBody(r), 200)
})
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        start_at: z.string().datetime(),
        end_at: z.string().datetime(),
        purpose: z.string().max(3_000).nullable().optional(),
      })
      .refine((d) => d.end_at > d.start_at, {
        message: "end_at must be after start_at",
        path: ["end_at"],
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
    const r = await new UpdateRoomReservation(c).run({
      reservationId: id,
      reserverId: viewer.employeeId,
      startAt: json.start_at,
      endAt: json.end_at,
      purpose: json.purpose ?? null,
    })
    if (r instanceof Error) {
      throw new InternalError("failed to update reservation")
    }
    if ("reason" in r) {
      if (r.reason === "invalid_time_range") {
        throw new BadRequestError("end_at must be after start_at")
      }
      if (r.reason === "reservation_not_found") {
        throw new NotFoundError("reservation not found")
      }
      if (r.reason === "not_reserver") {
        throw new ForbiddenError("not the reserver")
      }
      throw new ConflictError("the room is already reserved")
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
  const r = await new CancelRoomReservation(c).run({
    reservationId: id,
    reserverId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to cancel reservation")
  }
  if (r.reason === "reservation_not_found") {
    throw new NotFoundError("reservation not found")
  }
  if (r.reason === "not_reserver") {
    throw new ForbiddenError("not the reserver")
  }
  return c.body(null, 204)
})
