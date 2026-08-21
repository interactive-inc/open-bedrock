import type { RentalReservation } from "@/contexts/rental/domain/rental-reservation.entity"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  UnexpectedError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/contexts/rental/infrastructure/rental-reservation.repository"

export type Command = {
  reservationId: string
  requesterId: number
  itemName: string
  startDate: string
  endDate: string
  purpose: string | null
}

/**
 * レンタル予約の品名・期間・用途を変更する。本人以外の変更を拒否する。
 */
export class UpdateRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RentalReservation | ApplicationError> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("reservation is not modifiable", "not_modifiable")
    }

    const detailed = current.withDetails({
      itemName: command.itemName,
      startDate: command.startDate,
      endDate: command.endDate,
    })

    if ("reason" in detailed) {
      return new ValidationError("invalid date range", "invalid_date_range")
    }

    const updated = detailed.withPurpose(command.purpose)

    // 同一品名・重複期間の requested 予約（自身を除く）があれば 0 行更新となり null を返す。
    // チェックと UPDATE をアトミックに行い、並行リクエストによる二重予約を防ぐ。
    const result = await reservationRepository.updateIfNoOverlap(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update reservation", { cause: result })
    }

    // 0 行更新の理由（消失 / status 変更 / 重複）を再取得して判別する。
    if (result === null) {
      const latest = await reservationRepository.findById(command.reservationId)

      if (latest instanceof Error) {
        return new UnexpectedError("failed to find reservation", { cause: latest })
      }

      if (latest === null) {
        return new NotFoundError("reservation not found", "reservation_not_found")
      }

      if (latest.status !== "requested") {
        return new ConflictError("reservation is not modifiable", "not_modifiable")
      }

      return new ConflictError(
        "an overlapping rental reservation already exists",
        "overlapping_reservation",
      )
    }

    return result
  }
}
