import { Room } from "@/contexts/room/domain/entities/room.entity"
import type { Context } from "@/env"
import { rooms } from "@/contexts/room/infrastructure/schema/room"
import { asc, eq, sql } from "drizzle-orm"

type NewRoom = {
  name: string
  capacity: number
  location: string | null
}

export class RoomRepository {
  constructor(private readonly c: Context) {}

  /** 会議室マスタを登録順に返す。移行前の会議室は旧来の整数の主キーの順に並ぶ。 */
  async findAll(props: { limit: number; offset: number }): Promise<ReadonlyArray<Room> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(rooms)
        .orderBy(asc(rooms.createdAt), asc(sql`CAST(${rooms.legacyId} AS INTEGER)`), asc(rooms.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Room.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load rooms")
    }
  }

  /** 会議室 id で1件取得する。存在しなければ null。 */
  async findById(id: string): Promise<Room | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(rooms).where(eq(rooms.id, id)).limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Room.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load room")
    }
  }

  /** UUID を採番して insert し、書き込んだ行から復元する。 */
  async create(room: NewRoom): Promise<Room | Error> {
    try {
      const rows = await this.c.var.database
        .insert(rooms)
        .values({
          id: crypto.randomUUID(),
          name: room.name,
          capacity: room.capacity,
          location: room.location,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert room") : Room.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert room")
    }
  }

  /** 会議室の名称・定員・所在地を更新する。 */
  async update(room: Room): Promise<Room | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(rooms)
        .set({ name: room.name, capacity: room.capacity, location: room.location })
        .where(eq(rooms.id, room.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Room.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update room")
    }
  }

  /** 会議室を削除する。 */
  async delete(id: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(rooms).where(eq(rooms.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete room")
    }
  }

  async deleteWithReservations(room: Room): Promise<true | null | Error> {
    try {
      const db = this.c.env.DB
      const results = await db.batch([
        db.prepare("DELETE FROM room_reservations WHERE room_id = ?1").bind(room.id),
        db.prepare("DELETE FROM rooms WHERE id = ?1 RETURNING id").bind(room.id),
      ])
      return results.at(1)?.results.length === 0 ? null : true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete room")
    }
  }
}
