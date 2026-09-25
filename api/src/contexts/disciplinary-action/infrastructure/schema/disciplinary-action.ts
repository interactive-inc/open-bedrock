import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 懲戒の記録（非公開。本人にも見せない設計。判定は持たず事実の記録のみ）。 */
export const disciplinaryActions = sqliteTable(
  "disciplinary_actions",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    decidedOn: text("decided_on").notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("disciplinary_actions_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_disciplinary_actions_employee").on(table.employeeId),
  ],
)

export type DisciplinaryActionRow = InferSelectModel<typeof disciplinaryActions>
