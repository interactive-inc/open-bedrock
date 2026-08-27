import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 資産台帳（asset ドメイン）。code がPK。在庫/貸出/廃棄状態と保有者を持つ。 */
export const assets = sqliteTable("assets", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  serial: text("serial"),
  purchasedOn: text("purchased_on"),
  status: text("status").notNull(),
  holderEmployeeId: text("holder_employee_id").$type<EmployeeId>(),
  disposedOn: text("disposed_on"),
  disposalReason: text("disposal_reason"),
})

export type AssetRow = InferSelectModel<typeof assets>

/** 貸出記録。open は returned_at が NULL。返却で閉じる。 */
export const assetLendings = sqliteTable("asset_lendings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull(),
  employeeId: text("employee_id").$type<EmployeeId>().notNull(),
  lentAt: text("lent_at").notNull(),
  returnedAt: text("returned_at"),
})

export type AssetLendingRow = InferSelectModel<typeof assetLendings>
