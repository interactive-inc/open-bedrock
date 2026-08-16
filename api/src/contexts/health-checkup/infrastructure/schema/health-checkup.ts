import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 健康診断・ストレスチェックの実施記録のみ。要配慮個人情報である「結果」は絶対に持たない。 */
export const healthCheckups = sqliteTable(
  "health_checkups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    checkupKind: text("checkup_kind").notNull(),
    conductedOn: text("conducted_on"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_health_checkups_employee").on(table.employeeId),
    index("idx_health_checkups_fiscal_year").on(table.fiscalYear),
  ],
)

export type HealthCheckupRow = InferSelectModel<typeof healthCheckups>
