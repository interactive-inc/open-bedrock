import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { roomAvailabilityQuerySchema } from "@/contexts/room/interface/routes/rooms/availability/room-availability-query"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppRoomAvailabilityList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { roomReservations, rooms } from "@/contexts/room/infrastructure/schema/room"
import { and, count, gt, gte, inArray, lt } from "drizzle-orm"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
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

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  // limit/offset はグループ化前の JOIN 行ではなく会議室単位で適用するため、
  // まず rooms テーブルをページングしてから予約を取得して結合する。
  const pagedRooms = await c.var.database
    .select()
    .from(rooms)
    .where(gte(rooms.capacity, query.capacity))
    .orderBy(rooms.id)
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(rooms)
    .where(gte(rooms.capacity, query.capacity))

  if (pagedRooms.length === 0) {
    const emptyBody = zAppRoomAvailabilityList.parse({
      data: [],
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(emptyBody, 200)
  }

  const roomIds = pagedRooms.map((r) => r.id)

  // ページング済み会議室に絞って重複予約を取得する。
  const reservationRows = await c.var.database
    .select()
    .from(roomReservations)
    .where(
      and(
        inArray(roomReservations.roomId, roomIds),
        lt(roomReservations.startAt, query.end_at),
        gt(roomReservations.endAt, query.start_at),
      ),
    )

  // 会議室 id ごとにグループ化する。Map の挿入順を保つので元実装と同じ並びを保つ。
  const grouped = new Map<
    number,
    {
      room: { id: number; name: string; capacity: number }
      conflicts: Array<{ startAt: string; endAt: string; purpose: string | null }>
    }
  >()

  for (const room of pagedRooms) {
    grouped.set(room.id, {
      room: { id: room.id, name: room.name, capacity: room.capacity },
      conflicts: [],
    })
  }

  for (const reservation of reservationRows) {
    const entry = grouped.get(reservation.roomId)

    if (entry !== undefined) {
      entry.conflicts.push({
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        purpose: reservation.purpose,
      })
    }
  }

  const responseBody = zAppRoomAvailabilityList.parse({
    data: [...grouped.values()].map(({ room, conflicts }) => ({
      room,
      available: conflicts.length === 0,
      conflicts,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
