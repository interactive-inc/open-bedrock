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

  // N+1 を避けるため、対象会議室と時間範囲が重なる予約を 1 つの LEFT JOIN で取得する。
  // 重複予約のない会議室は reservation 側が null のまま 1 行返る。
  const joinedRows = await c.var.database
    .select({
      room: rooms,
      reservation: roomReservations,
    })
    .from(rooms)
    .leftJoin(
      roomReservations,
      and(
        eq(roomReservations.roomId, rooms.id),
        lt(roomReservations.startAt, query.end_at),
        gt(roomReservations.endAt, query.start_at),
      ),
    )
    .where(gte(rooms.capacity, query.capacity))

  // 会議室 id ごとに「最初に出現した順」でグループ化する。Map の挿入順を保つので
  // 元実装と同じ会議室並びを保つ。
  const grouped = new Map<
    number,
    {
      room: { id: number; name: string; capacity: number }
      conflicts: Array<{ startAt: string; endAt: string }>
    }
  >()

  for (const row of joinedRows) {
    const existing = grouped.get(row.room.id)

    if (existing === undefined) {
      grouped.set(row.room.id, {
        room: {
          id: row.room.id,
          name: row.room.name,
          capacity: row.room.capacity,
        },
        conflicts:
          row.reservation === null
            ? []
            : [{ startAt: row.reservation.startAt, endAt: row.reservation.endAt }],
      })
      continue
    }

    if (row.reservation !== null) {
      existing.conflicts.push({
        startAt: row.reservation.startAt,
        endAt: row.reservation.endAt,
      })
    }
  }

  const responseBody = [...grouped.values()].map(({ room, conflicts }) => ({
    room,
    available: conflicts.length === 0,
    conflicts,
  }))

  return c.json(responseBody, 200)
})
