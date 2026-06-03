import type { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  businessTripId: string
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
}

export type BusinessTripNotFound = { reason: "business_trip_not_found" }

export type NotTraveler = { reason: "not_traveler" }

/**
 * 出張申請の行き先・期間・目的・概算費用を変更する。本人以外の変更を拒否する。
 */
export class UpdateBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | BusinessTripNotFound | NotTraveler | Error> {
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

    const updated = current.withDetails({
      destination: command.destination,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      estimatedCost: command.estimatedCost,
    })

    return await businessTripRepository.update(updated)
  }
}
