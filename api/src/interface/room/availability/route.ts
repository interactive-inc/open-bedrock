import { factory } from "@/lib/factory"
import { roomAvailabilityQuerySchema } from "@/interface/room/availability/room-availability-query"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { BadRequestError, UnauthorizedError } from "@/interface/lib/errors"
import { roomReservations, rooms } from "@/schema"
import { and, eq, gt, gte, lt } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const parsed = roomAvailabilityQuerySchema.safeParse(c.req.query())

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const query = parsed.data

  const roomRows = await c.var.database
    .select()
    .from(rooms)
    .where(gte(rooms.capacity, query.capacity))

  const responseBody = []

  for (const room of roomRows) {
    const overlapping = await c.var.database
      .select()
      .from(roomReservations)
      .where(
        and(
          eq(roomReservations.roomId, room.id),
          lt(roomReservations.startAt, query.end_at),
          gt(roomReservations.endAt, query.start_at),
        ),
      )

    responseBody.push({
      room: {
        id: room.id,
        name: room.name,
        capacity: room.capacity,
      },
      available: overlapping.length === 0,
      conflicts: overlapping.map((reservation) => ({
        startAt: reservation.startAt,
        endAt: reservation.endAt,
      })),
    })
  }

  return c.json(responseBody, 200)
})
