import type { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  travelerId: number
}

/**
 * 申請者本人の出張申請を一覧する。
 */
export class ListMyBusinessTrips {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<BusinessTrip> | Error> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    return await businessTripRepository.findByTravelerId(command.travelerId)
  }
}
