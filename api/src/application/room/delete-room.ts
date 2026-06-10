import { canManageRooms } from "@/domain/room/can-manage-rooms"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"
import { RoomRepository } from "@/infrastructure/room/room-repository"

export type Command = {
  viewerRole: string
  roomId: number
}

export type DeleteForbidden = { reason: "forbidden" }

export type DeleteRoomNotFound = { reason: "room_not_found" }

export type Deleted = { reason: "deleted" }

export type DeleteRoomFailure = DeleteForbidden | DeleteRoomNotFound

/**
 * 権限と存在を確認し、紐づく予約を削除してから会議室マスタを削除する。
 */
export class DeleteRoom {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | DeleteRoomFailure | Error> {
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

    const reservationRepository = new RoomReservationRepository(this.c)

    const reservationsDeleted = await reservationRepository.deleteByRoomId(command.roomId)

    if (reservationsDeleted instanceof Error) {
      return reservationsDeleted
    }

    const deleted = await roomRepository.delete(command.roomId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
