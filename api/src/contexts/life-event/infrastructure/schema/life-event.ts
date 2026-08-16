import type { LifeEventType } from "@/lib/schemas"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** ライフイベント届出（結婚・出産・転居・忌引・扶養変更などの届出を記録） */
export const lifeEvents = sqliteTable("life_events", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  eventType: text("event_type").notNull().$type<LifeEventType>(),
  eventDate: text("event_date").notNull(),
  detail: text("detail"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type LifeEventRow = InferSelectModel<typeof lifeEvents>
