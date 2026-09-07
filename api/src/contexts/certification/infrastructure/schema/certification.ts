import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 資格・免許マスタ（コード・名称・発行元・説明）。会社で管理対象とする資格の台帳。 */
export const certifications = sqliteTable(
  "certification_definitions",
  {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
},
  (table) => [check("certification_definitions_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type CertificationRow = InferSelectModel<typeof certifications>

/** 従業員の資格保有記録（取得日・有効期限つき）。更新要否の判定はしない（台帳）。 */
export const employeeCertifications = sqliteTable(
  "employee_certifications",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    certificationId: text("certification_id")
      .notNull()
      .references(() => certifications.id, { onDelete: "restrict" }),
    acquiredOn: text("acquired_on").notNull(),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  // 同一従業員・同一資格・同一取得日の重複記録を DB レベルで防ぐ。
  (table) => [
    check("employee_certifications_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    check(
      "employee_certifications_certification_id_uuid",
      sql.raw(uuidCheckPredicate("certification_id")),
    ),
    uniqueIndex("idx_employee_certifications_unique").on(
      table.employeeId,
      table.certificationId,
      table.acquiredOn,
    ),
    index("idx_employee_certifications_employee").on(table.employeeId),
  ],
)

export type EmployeeCertificationRow = InferSelectModel<typeof employeeCertifications>
