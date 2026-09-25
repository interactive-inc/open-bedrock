import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 会議室マスタ（定員・所在地） */
export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  location: text("location"),
})

export type RoomRow = InferSelectModel<typeof rooms>

/** 会議室予約（重複判定は start_at/end_at の範囲で行う） */
export const roomReservations = sqliteTable(
  "room_reservations",
  {
    id: text("id").primaryKey().notNull(),
    roomId: integer("room_id").notNull(),
    reserverId: text("reserver_id").$type<EmployeeId>().notNull(),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    purpose: text("purpose"),
  },
  (table) => [
    check("room_reservations_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_room_reservations_reserver").on(table.reserverId),
    index("idx_room_reservations_overlap").on(table.roomId, table.startAt, table.endAt),
  ],
)

export type RoomReservationRow = InferSelectModel<typeof roomReservations>
