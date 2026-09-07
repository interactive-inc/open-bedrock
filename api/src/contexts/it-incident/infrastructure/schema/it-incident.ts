import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** インシデント記録（発生した障害・事故の事実記録。原因判定は持たない） */
export const itIncidents = sqliteTable(
  "it_incidents",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    severity: text("severity"),
    status: text("status").notNull(),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull(),
  },
  () => [check("it_incidents_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type ItIncidentRow = InferSelectModel<typeof itIncidents>
