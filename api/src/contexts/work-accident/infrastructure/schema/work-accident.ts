import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 労災・事故の発生記録。起きた事実の時系列記録のみ（記録）。対象者不特定の事故もあるため employee_id は NULL 可。 */
export const workAccidents = sqliteTable(
  "work_accidents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occurredOn: text("occurred_on").notNull(),
    employeeId: integer("employee_id"),
    location: text("location"),
    summary: text("summary").notNull(),
    severity: text("severity"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_work_accidents_occurred_on").on(table.occurredOn),
    index("idx_work_accidents_employee").on(table.employeeId),
  ],
)

export type WorkAccidentRow = InferSelectModel<typeof workAccidents>
