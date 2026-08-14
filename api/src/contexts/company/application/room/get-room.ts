import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Room } from "@/contexts/company/domain/room/room.entity"
import type { Context } from "@/env"
import { RoomRepository } from "@/contexts/company/infrastructure/room/room-repository"

export type Command = {
  roomId: number
}

/**
 * 会議室マスタを1件取得する。存在しなければ not found を返す。閲覧は全ロールに許可する。
 */
export class GetRoom {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Room | ApplicationError> {
    const roomRepository = new RoomRepository(this.c)

    const room = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return new UnexpectedError("failed to find room", { cause: room })
    }

    if (room === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    return room
  }
}
