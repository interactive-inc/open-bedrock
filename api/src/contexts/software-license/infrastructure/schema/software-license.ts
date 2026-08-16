import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** ライセンス・SaaS 台帳（更新期限・管理担当の事実記録。支払・会計連動は持たない） */
export const licenses = sqliteTable("software_licenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  vendor: text("vendor"),
  category: text("category"),
  seats: integer("seats"),
  renewalDeadline: text("renewal_deadline"),
  ownerEmployeeId: integer("owner_employee_id"),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type LicenseRow = InferSelectModel<typeof licenses>
