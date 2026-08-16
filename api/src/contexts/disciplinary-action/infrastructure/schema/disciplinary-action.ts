import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 懲戒の記録（非公開。本人にも見せない設計。判定は持たず事実の記録のみ）。 */
export const disciplinaryActions = sqliteTable(
  "disciplinary_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    decidedOn: text("decided_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_disciplinary_actions_employee").on(table.employeeId)],
)

export type DisciplinaryActionRow = InferSelectModel<typeof disciplinaryActions>
