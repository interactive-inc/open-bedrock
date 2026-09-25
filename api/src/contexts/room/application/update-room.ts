import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Room } from "@/contexts/room/domain/entities/room.entity"
import type { RoomRepository } from "@/contexts/room/infrastructure/repositories/room.repository"

type Context = Readonly<{
  roomRepository: Pick<RoomRepository, "findById" | "update">
}>

export type Command = {
  session: CompanySessionValue
  roomId: string
  details: {
    name: string
    capacity: number
    location: string | null
  }
}

/**
 * 権限と存在を確認し、会議室の名称・定員・所在地を更新する。
 */
export class UpdateRoom {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Room | ApplicationError> {
    if (command.session.hasPermission("room:manage") === false) {
      return new ForbiddenError("cannot manage rooms", "forbidden")
    }

    const room = await this.c.roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return new UnexpectedError("failed to find room", { cause: room })
    }

    if (room === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    const updated = await this.c.roomRepository.update(room.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update room", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    return updated
  }
}
