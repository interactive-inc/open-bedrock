import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 表彰の記録（社内公開。判定や評価計算は持たず事実の記録のみ）。 */
export const commendations = sqliteTable(
  "commendations",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    awardedOn: text("awarded_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("commendations_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_commendations_employee").on(table.employeeId),
  ],
)

export type CommendationRow = InferSelectModel<typeof commendations>
