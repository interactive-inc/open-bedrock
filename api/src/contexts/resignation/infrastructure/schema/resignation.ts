import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 退職申請（申出の受付から書類交付までの記録。法的判定は持たず記録のみ） */
export const resignations = sqliteTable(
  "resignations",
  {
    id: text("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    resignationDate: text("resignation_date").notNull(),
    lastWorkingDate: text("last_working_date"),
    reason: text("reason"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  // 1 社員につき requested の退職申請は 1 件まで（二重申請を防ぐ）。
  (table) => [
    uniqueIndex("idx_resignations_employee_requested")
      .on(table.employeeId)
      .where(sql`status = 'requested'`),
  ],
)

export type ResignationRow = InferSelectModel<typeof resignations>
