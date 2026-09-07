import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 労災・事故の発生記録。起きた事実の時系列記録のみ（記録）。対象者不特定の事故もあるため employee_id は NULL 可。 */
export const workAccidents = sqliteTable(
  "work_accidents",
  {
    id: text("id").primaryKey(),
    occurredOn: text("occurred_on").notNull(),
    employeeId: text("employee_id").$type<EmployeeId>(),
    location: text("location"),
    summary: text("summary").notNull(),
    severity: text("severity"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("work_accidents_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_work_accidents_occurred_on").on(table.occurredOn),
    index("idx_work_accidents_employee").on(table.employeeId),
  ],
)

export type WorkAccidentRow = InferSelectModel<typeof workAccidents>
