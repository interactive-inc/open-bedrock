import { RentalReservation } from "@/domain/rental/rental-reservation"
import type { Context } from "@/env"
import { rentalReservations } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export class RentalReservationRepository {
  constructor(private readonly c: Context) {}

  // 申請者本人の予約を開始日の昇順で返す。
  async findByRequesterId(requesterId: number): Promise<ReadonlyArray<RentalReservation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(rentalReservations)
        .where(eq(rentalReservations.requesterId, requesterId))
        .orderBy(asc(rentalReservations.startDate))

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
  async delete(id: string): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(rentalReservations)
        .where(and(eq(rentalReservations.id, id), eq(rentalReservations.status, "requested")))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete rental_reservation")
    }
  }
}
