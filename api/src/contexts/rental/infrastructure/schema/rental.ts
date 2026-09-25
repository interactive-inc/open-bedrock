import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 物のレンタル予約（外部からの貸与品の予約申請。期間と用途を記録） */
export const rentalReservations = sqliteTable(
  "rental_reservations",
  {
    id: text("id").primaryKey().notNull(),
    requesterId: text("requester_id").$type<EmployeeId>().notNull(),
    itemName: text("item_name").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    purpose: text("purpose"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  () => [check("rental_reservations_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type RentalReservationRow = InferSelectModel<typeof rentalReservations>
