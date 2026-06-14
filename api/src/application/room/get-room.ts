import type { Room } from "@/domain/room/room.entity"
import type { Context } from "@/env"
import { RoomRepository } from "@/infrastructure/room/room-repository"

export type Command = {
  roomId: number
}

export type RoomNotFound = { reason: "room_not_found" }

/**
 * 会議室マスタを1件取得する。存在しなければ not found を返す。閲覧は全ロールに許可する。
 */
export class GetRoom {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Room | RoomNotFound | Error> {
    const roomRepository = new RoomRepository(this.c)

    const room = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return room
    }

    if (room === null) {
      return { reason: "room_not_found" }
    }

    return room
  }
}
