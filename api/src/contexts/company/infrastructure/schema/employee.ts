import type { EmployeeStatus } from "@/contexts/company/domain/employee/employee-status"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { AccountId } from "@system/domain/values/account-id.schema"
import { systemAccounts } from "@system/infrastructure/schema/system-core"

/**
 * 従業員台帳。認証はSystem identity、認可はSystem IAMが正であり、Companyは人との対応だけを持つ。
 * codeは外部identityプロビジョニングで未採番の従業員を許すためnull許容。
 */
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey(),
  code: text("code").unique(),
  name: text("name").notNull(),
  deptId: integer("dept_id"),
  deptName: text("dept_name"),
  position: text("position"),
  status: text("status").notNull().$type<EmployeeStatus>(),
  phone: text("phone"),
  archivedAt: integer("archived_at"),
  archivedByAccountId: text("archived_by_account_id").$type<AccountId>(),
})

export type EmployeeRow = InferSelectModel<typeof employees>

/** Companyが所有するSystem Accountと従業員台帳の1対1対応。 */
export const accountEmployeeLinks = sqliteTable(
  "account_employee_links",
  {
    accountId: text("account_id")
      .primaryKey()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").notNull().unique(),
  },
  (table) => [index("idx_account_employee_links_employee").on(table.employeeId)],
)

export type AccountEmployeeLinkRow = InferSelectModel<typeof accountEmployeeLinks>
