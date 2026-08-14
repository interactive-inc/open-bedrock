import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RoomRepository } from "@/contexts/company/infrastructure/room/room-repository"

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
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const roomRepository = new RoomRepository(this.c)

    if (command.session.hasPermission("room:manage") === false) {
      return new ForbiddenError("cannot manage rooms", "forbidden")
    }

    const room = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return new UnexpectedError("failed to find room", { cause: room })
    }

    if (room === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    try {
      const db = this.c.env.DB

      const results = await db.batch([
        db.prepare("DELETE FROM room_reservations WHERE room_id = ?1").bind(command.roomId),
        db.prepare("DELETE FROM rooms WHERE id = ?1 RETURNING id").bind(command.roomId),
      ])

      const roomDeleteResult = results.at(1)

      if (roomDeleteResult === undefined || roomDeleteResult.results.length === 0) {
        return new NotFoundError("room not found", "room_not_found")
      }

      return { reason: "deleted" }
    } catch (error) {
      return error instanceof Error
        ? new UnexpectedError("failed to delete room", { cause: error })
        : new UnexpectedError("failed to delete room")
    }
  }
}
