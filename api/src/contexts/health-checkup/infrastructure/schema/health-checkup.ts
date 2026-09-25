import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 健康診断・ストレスチェックの実施記録のみ。要配慮個人情報である「結果」は絶対に持たない。 */
export const healthCheckups = sqliteTable(
  "health_checkups",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    checkupKind: text("checkup_kind").notNull(),
    conductedOn: text("conducted_on"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("health_checkups_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_health_checkups_employee").on(table.employeeId),
    index("idx_health_checkups_fiscal_year").on(table.fiscalYear),
  ],
)

export type HealthCheckupRow = InferSelectModel<typeof healthCheckups>
