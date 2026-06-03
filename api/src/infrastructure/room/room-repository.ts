import { Room } from "@/domain/room/room"
import type { Context } from "@/env"
import { rooms } from "@/schema"
import { asc, eq } from "drizzle-orm"

type NewRoom = {
  name: string
  capacity: number
  location: string | null
}

export class RoomRepository {
  constructor(private readonly c: Context) {}

  // 会議室マスタを id の昇順で返す。
  async findAll(): Promise<ReadonlyArray<Room> | Error> {
    try {
      const rows = await this.c.var.database.select().from(rooms).orderBy(asc(rooms.id))

      return rows.map((row) => Room.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load rooms")
    }
  }

  // 会議室 id で1件取得する。存在しなければ null。
  async findById(id: number): Promise<Room | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(rooms).where(eq(rooms.id, id)).limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Room.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load room")
    }
  }

  // id を渡さず insert し、DB autoincrement が採番した行から復元する。
  async create(room: NewRoom): Promise<Room | Error> {
    try {
      const rows = await this.c.var.database
        .insert(rooms)
        .values({ name: room.name, capacity: room.capacity, location: room.location })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert room") : Room.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert room")
    }
  }

  // 会議室の名称・定員・所在地を更新する。
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

  // 会議室を削除する。
  async delete(id: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(rooms).where(eq(rooms.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete room")
    }
  }
}
