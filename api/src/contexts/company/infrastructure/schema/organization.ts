import type { InferSelectModel } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** Companyが所有する部署マスタ。 */
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
})

export type DepartmentRow = InferSelectModel<typeof departments>

/** 組織図上の部署ノード。 */
export const orgDepartments = sqliteTable("org_departments", {
  code: text("code").primaryKey(),
  departmentId: integer("department_id").notNull(),
  parentCode: text("parent_code"),
  managerEmployeeCode: text("manager_employee_code"),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: integer("archived_at"),
  archivedByAccountId: integer("archived_by_account_id"),
})

export type OrgDepartmentRow = InferSelectModel<typeof orgDepartments>

/** 部署への所属。 */
export const orgMemberships = sqliteTable(
  "org_memberships",
  {
    departmentCode: text("department_code").notNull(),
    employeeCode: text("employee_code").notNull(),
    managerEmployeeCode: text("manager_employee_code"),
  },
  (table) => [primaryKey({ columns: [table.departmentCode, table.employeeCode] })],
)

export type OrgMembershipRow = InferSelectModel<typeof orgMemberships>
