import { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { businessTrips } from "@/schema"
import { and, asc, eq, lte, gte, ne } from "drizzle-orm"

export class BusinessTripRepository {
  constructor(private readonly c: Context) {}

  // 同一申請者で期間が重複する出張申請を返す。
  async findOverlapping(query: {
    travelerId: number
    startDate: string
    endDate: string
    excludeBusinessTripId: string | null
  }): Promise<ReadonlyArray<BusinessTrip> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(businessTrips)
        .where(
          and(
            eq(businessTrips.travelerId, query.travelerId),
            lte(businessTrips.startDate, query.endDate),
            gte(businessTrips.endDate, query.startDate),
            query.excludeBusinessTripId === null
              ? undefined
              : ne(businessTrips.id, query.excludeBusinessTripId),
          ),
        )

      return rows.map((row) => BusinessTrip.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load business_trips")
    }
  }

  // 申請者本人の出張申請を開始日の昇順で返す。
  async findByTravelerId(travelerId: number): Promise<ReadonlyArray<BusinessTrip> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(businessTrips)
        .where(eq(businessTrips.travelerId, travelerId))
        .orderBy(asc(businessTrips.startDate))

      return rows.map((row) => BusinessTrip.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load business_trips")
    }
  }

  // 出張申請 id で1件取得する。存在しなければ null。
  async findById(id: string): Promise<BusinessTrip | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(businessTrips)
        .where(eq(businessTrips.id, id))

      const row = rows.at(0)

      return row === undefined ? null : BusinessTrip.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load business_trip")
    }
  }

  async create(businessTrip: BusinessTrip): Promise<BusinessTrip | Error> {
    try {
      await this.c.var.database.insert(businessTrips).values({
        id: businessTrip.id,
        travelerId: businessTrip.travelerId,
        destination: businessTrip.destination,
        startDate: businessTrip.startDate,
        endDate: businessTrip.endDate,
        purpose: businessTrip.purpose,
        estimatedCost: businessTrip.estimatedCost,
        status: businessTrip.status,
        createdAt: businessTrip.createdAt,
      })

      return businessTrip
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save business_trip")
    }
  }

  // 出張申請の行き先・期間・目的・概算費用を更新する。
  async update(businessTrip: BusinessTrip): Promise<BusinessTrip | Error> {
    try {
      await this.c.var.database
        .update(businessTrips)
        .set({
          destination: businessTrip.destination,
          startDate: businessTrip.startDate,
          endDate: businessTrip.endDate,
          purpose: businessTrip.purpose,
          estimatedCost: businessTrip.estimatedCost,
        })
        .where(eq(businessTrips.id, businessTrip.id))

      return businessTrip
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update business_trip")
    }
  }

  // 出張申請を削除する。
  async delete(id: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(businessTrips).where(eq(businessTrips.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete business_trip")
    }
  }
}
