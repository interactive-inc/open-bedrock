import { CreateRoomReservation } from "@/application/room/create-room-reservation"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        room_id: z.number().int().positive(),
        start_at: z.string().datetime(),
        end_at: z.string().datetime(),
        purpose: z.string().max(3_000).nullable().optional(),
      })
      .refine((data) => data.end_at > data.start_at, {
        message: "end_at must be after start_at",
        path: ["end_at"],
      }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const reservation = await new CreateRoomReservation(c).run({
      roomId: json.room_id,
      reserverId: viewer.employeeId,
      startAt: json.start_at,
      endAt: json.end_at,
      purpose: json.purpose ?? null,
    })

    if (reservation instanceof Error) {
      throw new InternalError("failed to create reservation")
    }

    if ("reason" in reservation) {
      if (reservation.reason === "invalid_time_range") {
        throw new BadRequestError("end_at must be after start_at")
      }
      if (reservation.reason === "start_in_past") {
        throw new UnprocessableEntityError("start_at must be in the future")
      }
      if (reservation.reason === "room_not_found") {
        throw new NotFoundError("room not found")
      }
      throw new ConflictError("the room is already reserved")
    }

    const responseBody = {
      id: reservation.id,
      room_id: reservation.roomId,
      reserver_id: reservation.reserverId,
      start_at: reservation.startAt,
      end_at: reservation.endAt,
      purpose: reservation.purpose,
    }

    return c.json(responseBody, 201)
  },
)
