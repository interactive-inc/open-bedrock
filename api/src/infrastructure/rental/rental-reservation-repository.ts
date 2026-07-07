import { RentalReservation } from "@/domain/rental/rental-reservation.entity"
import type { Context } from "@/env"
import { rentalReservations } from "@/schema"
import { and, asc, eq, gte, lte, ne, sql } from "drizzle-orm"

export class RentalReservationRepository {
  constructor(private readonly c: Context) {}

  // 同一品名・期間が重複する requested 予約を返す。excludeId を指定すると自身を除外できる。
  async findOverlapping(query: {
    itemName: string
    startDate: string
    endDate: string
    excludeId?: string
  }): Promise<ReadonlyArray<RentalReservation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(rentalReservations)
        .where(
          and(
            eq(rentalReservations.itemName, query.itemName),
            eq(rentalReservations.status, "requested"),
            lte(rentalReservations.startDate, query.endDate),
            gte(rentalReservations.endDate, query.startDate),
            query.excludeId !== undefined ? ne(rentalReservations.id, query.excludeId) : undefined,
          ),
        )

      return rows.map((row) => RentalReservation.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load rental_reservations")
    }
  }

  // 申請者本人の予約を開始日の昇順で返す。
  async findByRequesterId(props: {
    requesterId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<RentalReservation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(rentalReservations)
        .where(eq(rentalReservations.requesterId, props.requesterId))
        .orderBy(asc(rentalReservations.startDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => RentalReservation.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load rental_reservations")
    }
  }

  // 予約 id で1件取得する。存在しなければ null。
  async findById(id: string): Promise<RentalReservation | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(rentalReservations)
        .where(eq(rentalReservations.id, id))

      const row = rows.at(0)

      return row === undefined ? null : RentalReservation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load rental_reservation")
    }
  }

  async create(reservation: RentalReservation): Promise<RentalReservation | Error> {
    try {
      await this.c.var.database.insert(rentalReservations).values({
        id: reservation.id,
        requesterId: reservation.requesterId,
        itemName: reservation.itemName,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        purpose: reservation.purpose,
        status: reservation.status,
        createdAt: reservation.createdAt,
      })

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save rental_reservation")
    }
  }

  // 重複予約がなければ INSERT し、競合があれば null を返す。チェックと INSERT をアトミックに行う。
  // 重複判定は findOverlapping と同じく inclusive 比較（start_date <= endDate AND end_date >= startDate）。
  async createIfNoOverlap(
    reservation: RentalReservation,
  ): Promise<RentalReservation | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO rental_reservations (id, requester_id, item_name, start_date, end_date, purpose, status, created_at)
            SELECT ${reservation.id}, ${reservation.requesterId}, ${reservation.itemName},
                   ${reservation.startDate}, ${reservation.endDate}, ${reservation.purpose},
                   ${reservation.status}, ${reservation.createdAt}
            WHERE NOT EXISTS (
              SELECT 1 FROM rental_reservations
              WHERE item_name = ${reservation.itemName}
                AND status = 'requested'
                AND start_date <= ${reservation.endDate}
                AND end_date >= ${reservation.startDate}
            )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save rental_reservation")
    }
  }

  // 重複予約がなければ UPDATE し、競合があれば null を返す。チェックと UPDATE をアトミックに行う。
  // 自身は重複判定から除外し、重複判定は inclusive 比較（start_date <= endDate AND end_date >= startDate）。
  async updateIfNoOverlap(
    reservation: RentalReservation,
  ): Promise<RentalReservation | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`UPDATE rental_reservations
            SET item_name  = ${reservation.itemName},
                start_date = ${reservation.startDate},
                end_date   = ${reservation.endDate},
                purpose    = ${reservation.purpose}
            WHERE id = ${reservation.id}
              AND status = 'requested'
              AND NOT EXISTS (
                SELECT 1 FROM rental_reservations
                WHERE item_name = ${reservation.itemName}
                  AND status = 'requested'
                  AND id != ${reservation.id}
                  AND start_date <= ${reservation.endDate}
                  AND end_date >= ${reservation.startDate}
              )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      return reservation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update rental_reservation")
    }
  }

  // 予約の品名・期間・用途を更新する。status が requested でなければ 0 行更新となり null を返す。
  async update(reservation: RentalReservation): Promise<RentalReservation | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(rentalReservations)
        .set({
          itemName: reservation.itemName,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
          purpose: reservation.purpose,
        })
        .where(
          and(
            eq(rentalReservations.id, reservation.id),
            eq(rentalReservations.status, "requested"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : RentalReservation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update rental_reservation")
    }
  }

  // status を fromStatus から toStatus へ遷移する。行が fromStatus でなければ 0 行更新となり null を返す。
  async updateStatus(props: {
    id: string
    fromStatus: string
    toStatus: string
  }): Promise<RentalReservation | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(rentalReservations)
        .set({ status: props.toStatus })
        .where(
          and(eq(rentalReservations.id, props.id), eq(rentalReservations.status, props.fromStatus)),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : RentalReservation.fromRow(row)
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("failed to update rental_reservation status")
    }
  }

  // 予約を削除する。status が requested の行のみ対象とする。
  // 0 行削除（対象なし or status が requested でない）なら null を返す。
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(rentalReservations)
        .where(and(eq(rentalReservations.id, id), eq(rentalReservations.status, "requested")))
        .returning({ id: rentalReservations.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete rental_reservation")
    }
  }
}
