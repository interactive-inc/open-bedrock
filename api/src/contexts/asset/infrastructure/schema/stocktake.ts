import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 棚卸しセッション（stocktake ドメイン）。open→closed の状態を持つ。 */
export const stocktakes = sqliteTable(
  "stocktakes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    targetDate: text("target_date").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [index("idx_stocktakes_status").on(table.status)],
)

export type StocktakeRow = InferSelectModel<typeof stocktakes>

/** 棚卸しセッションでの資産ごとの現物確認記録。checked_at:null は未確認。 */
export const stocktakeItems = sqliteTable(
  "stocktake_items",
  {
    stocktakeId: text("stocktake_id").notNull(),
    assetCode: text("asset_code").notNull(),
    checkedAt: text("checked_at"),
    checkerEmployeeId: text("checker_employee_id").$type<EmployeeId>(),
    locationNote: text("location_note"),
  },
  (table) => [primaryKey({ columns: [table.stocktakeId, table.assetCode] })],
)

export type StocktakeItemRow = InferSelectModel<typeof stocktakeItems>
