import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 出張申請（行き先・期間・目的・概算費用の記録。金額の計算や判定は持たず記録のみ） */
export const businessTrips = sqliteTable("business_trips", {
  id: text("id").primaryKey(),
  travelerId: text("traveler_id").$type<EmployeeId>().notNull(),
  destination: text("destination").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  purpose: text("purpose").notNull(),
  estimatedCost: integer("estimated_cost"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type BusinessTripRow = InferSelectModel<typeof businessTrips>
