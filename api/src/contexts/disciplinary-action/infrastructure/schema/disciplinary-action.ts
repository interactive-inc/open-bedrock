import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 懲戒の記録（非公開。本人にも見せない設計。判定は持たず事実の記録のみ）。 */
export const disciplinaryActions = sqliteTable(
  "disciplinary_actions",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    decidedOn: text("decided_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("disciplinary_actions_id_uuid", sql.raw(uuidCheckPredicate("id"))),index("idx_disciplinary_actions_employee").on(table.employeeId)],
)

export type DisciplinaryActionRow = InferSelectModel<typeof disciplinaryActions>
