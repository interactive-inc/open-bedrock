import type { Session } from "@/lib/auth/session"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Room } from "@/contexts/room/domain/entities/room.entity"
import type { Context } from "@/env"
import { RoomRepository } from "@/contexts/room/infrastructure/room.repository"

export type Command = {
  session: Session
  room: {
    name: string
    capacity: number
    location: string | null
  }
}

/**
 * 権限を確認し、新しい会議室を登録する。id は DB autoincrement に委ねる。
 */
export class RegisterRoom {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Room | ApplicationError> {
    const roomRepository = new RoomRepository(this.c)

    if (command.session.hasPermission("room:manage") === false) {
      return new ForbiddenError("cannot manage rooms", "forbidden")
    }

    const created = await roomRepository.create({
      name: command.room.name,
      capacity: command.room.capacity,
      location: command.room.location,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to create room", { cause: created })
    }

    return created
  }
}
