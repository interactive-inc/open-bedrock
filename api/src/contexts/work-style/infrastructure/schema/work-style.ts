import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { WorkStyle } from "@/contexts/work-style/domain/definitions/work-style.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 従業員の勤務形態の期間つき記録（regular / flextime / discretionary / shift）。制度の適法性判定はしない。事実の記録のみ。 */
export const employeeWorkStyles = sqliteTable(
  "employee_work_styles",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    style: text("style").notNull().$type<WorkStyle>(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("employee_work_styles_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_employee_work_styles_employee").on(table.employeeId),
  ],
)

export type EmployeeWorkStyleRow = InferSelectModel<typeof employeeWorkStyles>
