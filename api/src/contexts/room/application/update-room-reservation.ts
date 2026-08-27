import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { RoomReservation } from "@/contexts/room/domain/entities/room-reservation.entity"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/contexts/room/infrastructure/repositories/room-reservation.repository"

export type Command = {
  reservationId: string
  reserverId: EmployeeId
  startAt: string
  endAt: string
  purpose: string | null
}

/**
 * 会議室予約の時刻と用途を変更する。本人以外の変更と、変更後の時間帯の重複を拒否する。
 */
export class UpdateRoomReservation {
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

    const reservationRepository = new RoomReservationRepository(this.c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (current.reserverId !== command.reserverId) {
      return new ForbiddenError("not the reserver", "not_reserver")
    }

    const rescheduled = current.withRescheduled({
      startAt: command.startAt,
      endAt: command.endAt,
    })

    if ("reason" in rescheduled) {
      return new ValidationError("invalid time range", "invalid_time_range")
    }

    const updated = rescheduled.withPurpose(command.purpose)

    const result = await reservationRepository.updateIfNoOverlap(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update reservation", { cause: result })
    }

    // null は「重複予約」か「並行削除」のどちらか — findById で区別する
    if (result === null) {
      const stillExists = await reservationRepository.findById(command.reservationId)

      if (stillExists instanceof Error) {
        return new UnexpectedError("failed to find reservation", { cause: stillExists })
      }

      if (stillExists === null) {
        return new NotFoundError("reservation not found", "reservation_not_found")
      }

      return new ConflictError("the room is already reserved", "room_already_reserved")
    }

    return result
  }
}
