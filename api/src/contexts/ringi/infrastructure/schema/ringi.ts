import type { RingiStatus } from "@/lib/schemas"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 稟議（金額つきの汎用決裁）。起案時に承認者を 1 名指定する単段決裁。決裁結果は行に inline 保持する。 */
export const ringiRequests = sqliteTable("ringi_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicantId: integer("applicant_id").notNull(),
  approverId: integer("approver_id").notNull(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().$type<RingiStatus>(),
  decidedAt: text("decided_at"),
  decisionComment: text("decision_comment"),
  createdAt: text("created_at").notNull(),
})

export type RingiRequestRow = InferSelectModel<typeof ringiRequests>
