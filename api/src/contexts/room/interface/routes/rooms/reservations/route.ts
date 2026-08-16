import { CreateRoomReservation } from "@/contexts/room/application/create-room-reservation"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppRoomReservation } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
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

    if (reservation instanceof ApplicationError) {
      throw toHttpException(reservation)
    }

    const responseBody = zAppRoomReservation.parse({
      id: reservation.id,
      room_id: reservation.roomId,
      reserver_id: reservation.reserverId,
      start_at: reservation.startAt,
      end_at: reservation.endAt,
      purpose: reservation.purpose,
    })

    return c.json(responseBody, 201)
  },
)
