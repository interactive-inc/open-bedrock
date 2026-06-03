import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  businessTripId: string
  travelerId: number
}

export type BusinessTripNotFound = { reason: "business_trip_not_found" }

export type NotTraveler = { reason: "not_traveler" }

export type Cancelled = { reason: "cancelled" }

/**
 * 出張申請を取消する。本人以外の取消を拒否する。
 */
export class CancelBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | BusinessTripNotFound | NotTraveler | Error> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const current = await businessTripRepository.findById(command.businessTripId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "business_trip_not_found" }
    }

    if (current.travelerId !== command.travelerId) {
      return { reason: "not_traveler" }
    }

    const deleted = await businessTripRepository.delete(command.businessTripId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
