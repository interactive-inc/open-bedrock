import { canManageRooms } from "@/domain/room/can-manage-rooms"
import type { Room } from "@/domain/room/room"
import type { Context } from "@/env"
import { RoomRepository } from "@/infrastructure/room/room-repository"

export type Command = {
  viewerRole: string
  room: {
    name: string
    capacity: number
    location: string | null
  }
}

export type RoomForbidden = { reason: "forbidden" }

/**
 * 権限を確認し、新しい会議室を登録する。id は DB autoincrement に委ねる。
 */
export class RegisterRoom {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Room | RoomForbidden | Error> {
    const roomRepository = new RoomRepository(this.c)

    if (canManageRooms(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    return await roomRepository.create({
      name: command.room.name,
      capacity: command.room.capacity,
      location: command.room.location,
    })
  }
}
