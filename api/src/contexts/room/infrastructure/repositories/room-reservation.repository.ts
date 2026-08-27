import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { RoomReservation } from "@/contexts/room/domain/entities/room-reservation.entity"
import type { Context } from "@/env"
import { roomReservations } from "@/contexts/room/infrastructure/schema/room"
import { and, asc, eq, gt, lt, ne, sql } from "drizzle-orm"

type OverlapQuery = {
  roomId: number
  startAt: string
  endAt: string
  // 変更時に自分自身の予約を重複対象から除外するための予約 id。
  excludeReservationId: string | null
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
            query.excludeReservationId === null
              ? undefined
              : ne(roomReservations.id, query.excludeReservationId),
          ),
        )

      const reservations: Array<RoomReservation> = []

      for (const row of rows) {
        const reservation = RoomReservation.fromRow(row)
        if (reservation instanceof Error) return reservation
        reservations.push(reservation)
      }

      return reservations
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load room_reservations")
    }
  }

  /** 予約者本人の予約を開始時刻の昇順で返す。 */
  async findByReserverId(
    reserverId: EmployeeId,
    pagination: { limit: number; offset: number },
  ): Promise<ReadonlyArray<RoomReservation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(roomReservations)
        .where(eq(roomReservations.reserverId, reserverId))
        .orderBy(asc(roomReservations.startAt))
        .limit(pagination.limit)
        .offset(pagination.offset)

      const reservations: Array<RoomReservation> = []

      for (const row of rows) {
        const reservation = RoomReservation.fromRow(row)
        if (reservation instanceof Error) return reservation
        reservations.push(reservation)
      }

      return reservations
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load room_reservations")
    }
  }

  /** 予約 id で1件取得する。存在しなければ null。 */
  async findById(id: string): Promise<RoomReservation | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(roomReservations)
        .where(eq(roomReservations.id, id))

      const row = rows.at(0)

      if (row === undefined) return null

      return RoomReservation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load room_reservation")
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

  /** 重複予約がなければ INSERT し、競合があれば null を返す。チェックと INSERT をアトミックに行う。 */
  async createIfNoOverlap(reservation: RoomReservation): Promise<RoomReservation | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO room_reservations (id, room_id, reserver_id, start_at, end_at, purpose)
            SELECT ${reservation.id}, ${reservation.roomId}, ${reservation.reserverId},
                   ${reservation.startAt}, ${reservation.endAt}, ${reservation.purpose}
            WHERE NOT EXISTS (
              SELECT 1 FROM room_reservations
              WHERE room_id = ${reservation.roomId}
                AND start_at < ${reservation.endAt}
                AND end_at > ${reservation.startAt}
            )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save room_reservation")
    }
  }

  /** 重複予約がなければ UPDATE し、競合があれば null を返す。チェックと UPDATE をアトミックに行う。 */
  async updateIfNoOverlap(reservation: RoomReservation): Promise<RoomReservation | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`UPDATE room_reservations
            SET start_at = ${reservation.startAt},
                end_at   = ${reservation.endAt},
                purpose  = ${reservation.purpose}
            WHERE id = ${reservation.id}
              AND NOT EXISTS (
                SELECT 1 FROM room_reservations
                WHERE room_id = ${reservation.roomId}
                  AND id != ${reservation.id}
                  AND start_at < ${reservation.endAt}
                  AND end_at   > ${reservation.startAt}
              )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update room_reservation")
    }
  }

  /** 予約の開始終了時刻と用途を更新する。対象が存在しなければ null を返す。 */
  async update(reservation: RoomReservation): Promise<RoomReservation | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(roomReservations)
        .set({
          startAt: reservation.startAt,
          endAt: reservation.endAt,
          purpose: reservation.purpose,
        })
        .where(eq(roomReservations.id, reservation.id))
        .returning({ id: roomReservations.id })

      if (rows.length === 0) {
        return null
      }

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update room_reservation")
    }
  }

  /** 予約者本人の予約を削除する。所有権チェックと削除をアトミックに行う。 */
  async deleteByIdAndReserverId(id: string, reserverId: EmployeeId): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(roomReservations)
        .where(and(eq(roomReservations.id, id), eq(roomReservations.reserverId, reserverId)))
        .returning({ id: roomReservations.id })

      if (rows.length === 0) {
        return null
      }

      return true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete room_reservation")
    }
  }

  /** 予約を削除する。削除できた場合は true、対象が存在しなかった場合は null を返す。 */
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(roomReservations)
        .where(eq(roomReservations.id, id))
        .returning({ id: roomReservations.id })

      if (rows.length === 0) {
        return null
      }

      return true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete room_reservation")
    }
  }

  /** 指定した会議室に紐づく予約をすべて削除する。 */
  async deleteByRoomId(roomId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(roomReservations).where(eq(roomReservations.roomId, roomId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete room_reservations")
    }
  }
}
