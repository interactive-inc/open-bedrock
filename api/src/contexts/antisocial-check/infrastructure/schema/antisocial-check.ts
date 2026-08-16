import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 反社チェックの申請（取引先の確認情報と判定結果を記録） */
export const antisocialChecks = sqliteTable("antisocial_checks", {
  id: text("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  partnerName: text("partner_name").notNull(),
  partnerAddress: text("partner_address"),
  representativeName: text("representative_name"),
  result: text("result"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type AntisocialCheckRow = InferSelectModel<typeof antisocialChecks>
