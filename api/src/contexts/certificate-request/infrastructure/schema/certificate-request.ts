import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 証明書発行依頼（在職・就労・退職証明書などの発行依頼を記録） */
export const certificateRequests = sqliteTable("certificate_requests", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").$type<EmployeeId>().notNull(),
  certificateType: text("certificate_type").notNull(),
  submitTo: text("submit_to"),
  neededBy: text("needed_by"),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type CertificateRequestRow = InferSelectModel<typeof certificateRequests>
