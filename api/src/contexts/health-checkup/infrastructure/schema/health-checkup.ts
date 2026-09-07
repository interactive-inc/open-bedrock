import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 健康診断・ストレスチェックの実施記録のみ。要配慮個人情報である「結果」は絶対に持たない。 */
export const healthCheckups = sqliteTable(
  "health_checkups",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    checkupKind: text("checkup_kind").notNull(),
    conductedOn: text("conducted_on"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("health_checkups_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_health_checkups_employee").on(table.employeeId),
    index("idx_health_checkups_fiscal_year").on(table.fiscalYear),
  ],
)

export type HealthCheckupRow = InferSelectModel<typeof healthCheckups>
