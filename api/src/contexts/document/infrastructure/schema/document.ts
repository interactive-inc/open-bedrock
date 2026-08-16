import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 文書台帳（契約書・許認可などのメタデータ台帳。本体ファイルは持たず所在のみ記録する）。 */
export const documents = sqliteTable(
  "document_ledger_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    category: text("category"),
    location: text("location").notNull(),
    partnerCode: text("partner_code"),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_documents_expires_on").on(table.expiresOn)],
)

export type DocumentRow = InferSelectModel<typeof documents>
