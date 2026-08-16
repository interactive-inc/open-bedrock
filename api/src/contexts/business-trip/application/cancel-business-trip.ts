import type { Context } from "@/env"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/business-trip-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  businessTripId: string
  travelerId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 出張申請を取消する。本人以外と、承認済み申請の取消を拒否する。
 */
export class CancelBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const current = await businessTripRepository.findById(command.businessTripId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find business trip", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("business trip not found", "business_trip_not_found")
    }

    if (current.travelerId !== command.travelerId) {
      return new ForbiddenError("not the traveler", "not_traveler")
    }

    if (!current.isModifiable) {
      return new ConflictError("business trip is not modifiable", "not_modifiable")
    }

    const deleted = await businessTripRepository.delete(command.businessTripId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete business trip", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("business trip is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
