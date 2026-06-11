import { RentalReservation } from "@/domain/rental/rental-reservation"
import type { Context } from "@/env"
import { rentalReservations } from "@/schema"
import { and, asc, eq, gte, lte, ne, sql } from "drizzle-orm"

export class RentalReservationRepository {
  constructor(private readonly c: Context) {}

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

  // 同一品名の requested 予約のうち、指定期間と重なるものを返す。
  // 期間 [startA, endA] と [startB, endB] は startA <= endB かつ startB <= endA で重複する。
  // excludeId を渡すと当該予約自身を除外する（更新時に自己ヒットを防ぐ）。
  async findOverlapping(props: {
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
            eq(rentalReservations.itemName, props.itemName),
            eq(rentalReservations.status, "requested"),
            lte(rentalReservations.startDate, props.endDate),
            gte(rentalReservations.endDate, props.startDate),
            props.excludeId === undefined ? undefined : ne(rentalReservations.id, props.excludeId),
          ),
        )

      return rows.map((row) => RentalReservation.fromRow(row))
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("failed to query rental_reservation overlap")
    }
  }

  // 重複チェックと INSERT をアトミックに行い TOCTOU 競合を防ぐ。
  // 同一品名の requested 予約と期間が重なる行があれば INSERT をスキップし null を返す。
  async create(reservation: RentalReservation): Promise<RentalReservation | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO rental_reservations (id, requester_id, item_name, start_date, end_date, purpose, status, created_at)
            SELECT ${reservation.id}, ${reservation.requesterId},
                   ${reservation.itemName}, ${reservation.startDate},
                   ${reservation.endDate}, ${reservation.purpose},
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
