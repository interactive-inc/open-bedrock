import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 反社チェックの申請（取引先の確認情報と判定結果を記録） */
export const antisocialChecks = sqliteTable("antisocial_checks", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").$type<EmployeeId>().notNull(),
  partnerName: text("partner_name").notNull(),
  partnerAddress: text("partner_address"),
  representativeName: text("representative_name"),
  result: text("result"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type AntisocialCheckRow = InferSelectModel<typeof antisocialChecks>
