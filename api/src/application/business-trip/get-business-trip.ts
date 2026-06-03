import type { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  businessTripId: string
  travelerId: number
}

export type BusinessTripNotFound = { reason: "business_trip_not_found" }

export type NotTraveler = { reason: "not_traveler" }

/**
 * 出張申請を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | BusinessTripNotFound | NotTraveler | Error> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const businessTrip = await businessTripRepository.findById(command.businessTripId)

    if (businessTrip instanceof Error) {
      return businessTrip
    }

    if (businessTrip === null) {
      return { reason: "business_trip_not_found" }
    }

    if (businessTrip.travelerId !== command.travelerId) {
      return { reason: "not_traveler" }
    }

    return businessTrip
  }
}
