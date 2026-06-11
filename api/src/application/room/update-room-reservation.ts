import type { RoomReservation } from "@/domain/room/room-reservation"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"

export type Command = {
  reservationId: string
  reserverId: number
  startAt: string
  endAt: string
  purpose: string | null
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type NotReserver = { reason: "not_reserver" }

export type RoomAlreadyReserved = { reason: "room_already_reserved" }

export type InvalidTimeRange = { reason: "invalid_time_range" }

/**
 * 会議室予約の時刻と用途を変更する。本人以外の変更と、変更後の時間帯の重複を拒否する。
 */
export class UpdateRoomReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | RoomReservation
    | ReservationNotFound
    | NotReserver
    | RoomAlreadyReserved
    | InvalidTimeRange
    | Error
  > {
    if (command.startAt >= command.endAt) {
      return { reason: "invalid_time_range" }
    }

    const reservationRepository = new RoomReservationRepository(this.c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "reservation_not_found" }
    }

    if (current.reserverId !== command.reserverId) {
      return { reason: "not_reserver" }
    }

    const rescheduled = current.withRescheduled({
      startAt: command.startAt,
      endAt: command.endAt,
    })

    if ("reason" in rescheduled) {
      return rescheduled
    }

    const updated = rescheduled.withPurpose(command.purpose)

    const result = await reservationRepository.updateIfNoOverlap(updated)

    if (result instanceof Error) {
      return result
    }

    // null は「重複予約」か「並行削除」のどちらか — findById で区別する
    if (result === null) {
      const stillExists = await reservationRepository.findById(
        command.reservationId,
      )
      if (stillExists instanceof Error) {
        return stillExists
      }
      if (stillExists === null) {
        return { reason: "reservation_not_found" }
      }
      return { reason: "room_already_reserved" }
    }

    return result
  }
}
