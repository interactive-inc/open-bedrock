import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 物のレンタル予約（外部からの貸与品の予約申請。期間と用途を記録） */
export const rentalReservations = sqliteTable("rental_reservations", {
  id: text("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  itemName: text("item_name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  purpose: text("purpose"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type RentalReservationRow = InferSelectModel<typeof rentalReservations>
