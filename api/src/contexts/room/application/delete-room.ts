import type { Session } from "@/lib/auth/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RoomRepository } from "@/contexts/room/infrastructure/repositories/room.repository"
import type { Room } from "@/contexts/room/domain/entities/room.entity"

export type Command = {
  session: Session
  roomId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 権限と存在を確認し、紐づく予約と会議室マスタを D1 batch でアトミックに削除する。
 * rooms DELETE に RETURNING id を付与し、0 行削除（TOCTOU 競合）は not_found として扱う。
 */
export class DeleteRoom {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const roomRepository = new RoomRepository(this.c)

    if (command.session.hasPermission("room:manage") === false) {
      return new ForbiddenError("cannot manage rooms", "forbidden")
    }

    const room: Room | null | Error = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return new UnexpectedError("failed to find room", { cause: room })
    }

    if (room === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    const deleted = await roomRepository.deleteWithReservations(room)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete room", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    return { reason: "deleted" }
  }
}
