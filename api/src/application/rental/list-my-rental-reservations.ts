import type { RentalReservation } from "@/domain/rental/rental-reservation.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Command = {
  requesterId: number
  limit: number
  offset: number
}

/**
 * 申請者本人のレンタル予約を一覧する。
 */
export class ListMyRentalReservations {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<RentalReservation> | ApplicationError> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const reservations = await reservationRepository.findByRequesterId({
      requesterId: command.requesterId,
      limit: command.limit,
      offset: command.offset,
    })

    if (reservations instanceof Error) {
      return new UnexpectedError("failed to find reservations", { cause: reservations })
    }

    return reservations
  }
}
