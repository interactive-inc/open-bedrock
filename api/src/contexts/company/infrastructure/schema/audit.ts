import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable } from "drizzle-orm/sqlite-core"

/** Company: System 監査イベントへ Employee 文脈を付与する append-only satellite。 */
export const auditEventEmployeeContexts = sqliteTable(
  "audit_event_employee_contexts",
  {
    auditEventId: integer("audit_event_id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
  },
  (table) => [
    index("idx_audit_event_employee_contexts_employee").on(table.employeeId, table.auditEventId),
  ],
)

export type AuditEventEmployeeContextRow = InferSelectModel<typeof auditEventEmployeeContexts>
