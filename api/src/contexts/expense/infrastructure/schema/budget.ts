import type { InferSelectModel } from "drizzle-orm"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { organizationUnits } from "@/contexts/company/infrastructure/schema/organization"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 部署予算（部署・会計期間・金額の記録）。消化額は保持せず、承認済み経費の読み取り集計で算出する。 */
export const budgets = sqliteTable("expense_budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationUnitId: text("organization_unit_id")
    .$type<OrganizationUnitId>()
    .notNull()
    .references(() => organizationUnits.id, { onDelete: "restrict" }),
  fiscalPeriod: text("fiscal_period").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  amount: integer("amount").notNull(),
  name: text("name").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
})

export type BudgetRow = InferSelectModel<typeof budgets>
