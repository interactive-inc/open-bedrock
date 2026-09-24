import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { RoomReservation } from "@/contexts/room/domain/entities/room-reservation.entity"
import {
  ConflictError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { RoomReservationRepository } from "@/contexts/room/infrastructure/repositories/room-reservation.repository"
import type { RoomRepository } from "@/contexts/room/infrastructure/repositories/room.repository"

type Context = Readonly<{
  roomRepository: Pick<RoomRepository, "findById">
  reservationRepository: Pick<RoomReservationRepository, "createIfNoOverlap">
  /** 開始時刻が過去かを判定する基準のISO時刻。 */
  now: string
}>

export type Command = {
  roomId: number
  reserverId: EmployeeId
  startAt: string
  endAt: string
  purpose: string | null
}

/**
 * 会議室を予約する。会議室が存在しない場合、重複時は判別可能な失敗を返す。
 */
export class CreateRoomReservation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<RoomReservation | ApplicationError> {
    if (command.startAt >= command.endAt) {
      return new ValidationError("invalid time range", "invalid_time_range")
    }

    if (command.startAt < this.c.now) {
      return new UnprocessableError("start_at must be in the future", "start_in_past")
    }

    const room = await this.c.roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return new UnexpectedError("failed to find room", { cause: room })
    }

    if (room === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    const reservation = RoomReservation.create({
      roomId: command.roomId,
      reserverId: command.reserverId,
      startAt: command.startAt,
      endAt: command.endAt,
      purpose: command.purpose,
    })

    if ("reason" in reservation) {
      return new ValidationError("invalid time range", "invalid_time_range")
    }

    const created = await this.c.reservationRepository.createIfNoOverlap(reservation)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create reservation", { cause: created })
    }

    if (created === null) {
      return new ConflictError("the room is already reserved", "room_already_reserved")
    }

    return created
  }
}
