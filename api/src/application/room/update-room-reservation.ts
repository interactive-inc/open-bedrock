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

/**
 * 会議室予約の時刻と用途を変更する。本人以外の変更と、変更後の時間帯の重複を拒否する。
 */
export class UpdateRoomReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<RoomReservation | ReservationNotFound | NotReserver | RoomAlreadyReserved | Error> {
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

    const overlapping = await reservationRepository.findOverlapping({
      roomId: current.roomId,
      startAt: command.startAt,
      endAt: command.endAt,
      excludeReservationId: current.id,
    })

    if (overlapping instanceof Error) {
      return overlapping
    }

    if (overlapping.length > 0) {
      return { reason: "room_already_reserved" }
    }

    const updated = current
      .withRescheduled({ startAt: command.startAt, endAt: command.endAt })
      .withPurpose(command.purpose)

    return await reservationRepository.update(updated)
  }
}
