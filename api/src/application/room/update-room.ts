import { canManageRooms } from "@/lib/room/can-manage-rooms"
import type { Room } from "@/domain/room/room.entity"
import type { Context } from "@/env"
import { RoomRepository } from "@/infrastructure/room/room-repository"

export type Command = {
  viewerRole: string
  roomId: number
  details: {
    name: string
    capacity: number
    location: string | null
  }
}

export type UpdateForbidden = { reason: "forbidden" }

export type UpdateRoomNotFound = { reason: "room_not_found" }

export type UpdateRoomFailure = UpdateForbidden | UpdateRoomNotFound

/**
 * 権限と存在を確認し、会議室の名称・定員・所在地を更新する。
 */
export class UpdateRoom {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Room | UpdateRoomFailure | Error> {
    const roomRepository = new RoomRepository(this.c)

    if (canManageRooms(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const room = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return room
    }

    if (room === null) {
      return { reason: "room_not_found" }
    }

    const updated = await roomRepository.update(room.withDetails(command.details))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "room_not_found" }
    }

    return updated
  }
}
