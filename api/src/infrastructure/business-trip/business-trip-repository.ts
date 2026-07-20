import { BusinessTrip } from "@/domain/business-trip/business-trip.entity"
import type { Context } from "@/env"
import { businessTrips } from "@/schema"
import { and, asc, eq, inArray, lte, gte, ne, sql } from "drizzle-orm"

export class BusinessTripRepository {
  constructor(private readonly c: Context) {}

  /** 同一申請者で期間が重複する出張申請を返す。 */
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
            inArray(businessTrips.status, ["requested", "approved"]),
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

  /** 申請者本人の出張申請を開始日の昇順でページングして返す。 */
  async findByTravelerId(props: {
    travelerId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<BusinessTrip> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(businessTrips)
        .where(eq(businessTrips.travelerId, props.travelerId))
        .orderBy(asc(businessTrips.startDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => BusinessTrip.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load business_trips")
    }
  }

  /** 出張申請 id で1件取得する。存在しなければ null。 */
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

  async create(businessTrip: BusinessTrip): Promise<BusinessTrip | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO business_trips (id, traveler_id, destination, start_date, end_date, purpose, estimated_cost, status, created_at)
            SELECT ${businessTrip.id}, ${businessTrip.travelerId}, ${businessTrip.destination},
                   ${businessTrip.startDate}, ${businessTrip.endDate},
                   ${businessTrip.purpose}, ${businessTrip.estimatedCost},
                   ${businessTrip.status}, ${businessTrip.createdAt}
            WHERE NOT EXISTS (
              SELECT 1 FROM business_trips
              WHERE traveler_id = ${businessTrip.travelerId}
                AND status IN ('requested', 'approved')
                AND start_date <= ${businessTrip.endDate}
                AND end_date >= ${businessTrip.startDate}
            )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      return businessTrip
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save business_trip")
    }
  }

  /** 出張申請の行き先・期間・目的・概算費用を更新する。status が requested のときのみ更新し、0 行更新は null を返す。 */
  async update(businessTrip: BusinessTrip): Promise<BusinessTrip | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(businessTrips)
        .set({
          destination: businessTrip.destination,
          startDate: businessTrip.startDate,
          endDate: businessTrip.endDate,
          purpose: businessTrip.purpose,
          estimatedCost: businessTrip.estimatedCost,
        })
        .where(and(eq(businessTrips.id, businessTrip.id), eq(businessTrips.status, "requested")))
        .returning()

      return rows.length === 0 ? null : businessTrip
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update business_trip")
    }
  }

  /** status を fromStatus から toStatus へ遷移する。行が fromStatus でなければ 0 行更新となり null を返す。 */
  async updateStatus(props: {
    id: string
    fromStatus: string
    toStatus: string
  }): Promise<BusinessTrip | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(businessTrips)
        .set({ status: props.toStatus })
        .where(and(eq(businessTrips.id, props.id), eq(businessTrips.status, props.fromStatus)))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : BusinessTrip.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update business_trip status")
    }
  }

  /** 出張申請を削除する。status が requested のときのみ削除し、0 行削除は null を返す。 */
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(businessTrips)
        .where(and(eq(businessTrips.id, id), eq(businessTrips.status, "requested")))
        .returning({ id: businessTrips.id })

      return rows.length === 0 ? null : true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete business_trip")
    }
  }
}
