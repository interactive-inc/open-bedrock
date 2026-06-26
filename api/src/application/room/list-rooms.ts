import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Room } from "@/domain/room/room.entity"
import type { Context } from "@/env"
import { RoomRepository } from "@/infrastructure/room/room-repository"

/**
 * 会議室マスタの一覧を返す。閲覧は全ロールに許可する。
 */
export class ListRooms {
  constructor(private readonly c: Context) {}

  async run(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Room> | ApplicationError> {
    const roomRepository = new RoomRepository(this.c)

    const rooms = await roomRepository.findAll({ limit: props.limit, offset: props.offset })

    if (rooms instanceof Error) {
      return new UnexpectedError("failed to find rooms", { cause: rooms })
    }

    return rooms
  }
}
