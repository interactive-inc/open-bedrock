import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 資格・免許マスタ（コード・名称・発行元・説明）。会社で管理対象とする資格の台帳。 */
export const certifications = sqliteTable("certification_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
})

export type CertificationRow = InferSelectModel<typeof certifications>

/** 従業員の資格保有記録（取得日・有効期限つき）。更新要否の判定はしない（台帳）。 */
export const employeeCertifications = sqliteTable(
  "employee_certifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    certificationId: integer("certification_id").notNull(),
    acquiredOn: text("acquired_on").notNull(),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  // 同一従業員・同一資格・同一取得日の重複記録を DB レベルで防ぐ。
  (table) => [
    uniqueIndex("idx_employee_certifications_unique").on(
      table.employeeId,
      table.certificationId,
      table.acquiredOn,
    ),
    index("idx_employee_certifications_employee").on(table.employeeId),
  ],
)

export type EmployeeCertificationRow = InferSelectModel<typeof employeeCertifications>
