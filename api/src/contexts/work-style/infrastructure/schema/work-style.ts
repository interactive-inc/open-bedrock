import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { WorkStyle } from "@/contexts/work-style/domain/definitions/work-style.definition"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 従業員の勤務形態の期間つき記録（regular / flextime / discretionary / shift）。制度の適法性判定はしない。事実の記録のみ。 */
export const employeeWorkStyles = sqliteTable(
  "employee_work_styles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    style: text("style").notNull().$type<WorkStyle>(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_employee_work_styles_employee").on(table.employeeId)],
)

export type EmployeeWorkStyleRow = InferSelectModel<typeof employeeWorkStyles>
