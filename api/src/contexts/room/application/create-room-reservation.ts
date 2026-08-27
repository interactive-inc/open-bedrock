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
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/contexts/room/infrastructure/repositories/room-reservation.repository"
import { RoomRepository } from "@/contexts/room/infrastructure/repositories/room.repository"

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

    const now = this.c.env.NOW ?? new Date().toISOString()

    if (command.startAt < now) {
      return new UnprocessableError("start_at must be in the future", "start_in_past")
    }

    const roomRepository = new RoomRepository(this.c)

    const room = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return new UnexpectedError("failed to find room", { cause: room })
    }

    if (room === null) {
      return new NotFoundError("room not found", "room_not_found")
    }

    const reservationRepository = new RoomReservationRepository(this.c)

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

    const created = await reservationRepository.createIfNoOverlap(reservation)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create reservation", { cause: created })
    }

    if (created === null) {
      return new ConflictError("the room is already reserved", "room_already_reserved")
    }

    return created
  }
}
