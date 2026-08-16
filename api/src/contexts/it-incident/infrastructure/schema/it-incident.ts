import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** インシデント記録（発生した障害・事故の事実記録。原因判定は持たない） */
export const itIncidents = sqliteTable("it_incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  occurredAt: text("occurred_at").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  severity: text("severity"),
  status: text("status").notNull(),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
})

export type ItIncidentRow = InferSelectModel<typeof itIncidents>
