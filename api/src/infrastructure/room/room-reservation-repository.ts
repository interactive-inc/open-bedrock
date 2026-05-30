import { RoomReservation } from "@/domain/room/room-reservation"
import type { Context } from "@/env"
import { roomReservations } from "@/schema"
import { and, eq, gt, lt } from "drizzle-orm"

type OverlapQuery = {
  roomId: number
  startAt: string
  endAt: string
}

export class RoomReservationRepository {
  constructor(private readonly c: Context) {}

  async findOverlapping(query: OverlapQuery): Promise<ReadonlyArray<RoomReservation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(roomReservations)
        .where(
          and(
            eq(roomReservations.roomId, query.roomId),
            lt(roomReservations.startAt, query.endAt),
            gt(roomReservations.endAt, query.startAt),
          ),
        )

      return rows.map((row) => RoomReservation.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load room_reservations")
    }
  }

  async create(reservation: RoomReservation): Promise<RoomReservation | Error> {
    try {
      await this.c.var.database.insert(roomReservations).values({
        id: reservation.id,
        roomId: reservation.roomId,
        reserverId: reservation.reserverId,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        purpose: reservation.purpose,
      })

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save room_reservation")
    }
  }
}
