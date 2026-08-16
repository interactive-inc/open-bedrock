import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 表彰の記録（社内公開。判定や評価計算は持たず事実の記録のみ）。 */
export const commendations = sqliteTable(
  "commendations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    awardedOn: text("awarded_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_commendations_employee").on(table.employeeId)],
)

export type CommendationRow = InferSelectModel<typeof commendations>
