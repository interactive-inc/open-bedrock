import { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
  createdAt: string
}

/**
 * 出張申請を作成する。status は "requested" で登録する。
 */
export class CreateBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | Error> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const businessTrip = BusinessTrip.create({
      travelerId: command.travelerId,
      destination: command.destination,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      estimatedCost: command.estimatedCost,
      createdAt: command.createdAt,
    })

    return await businessTripRepository.create(businessTrip)
  }
}
