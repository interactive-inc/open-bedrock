import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 文書台帳（契約書・許認可などのメタデータ台帳。本体ファイルは持たず所在のみ記録する）。 */
export const documents = sqliteTable(
  "document_ledger_entries",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category"),
    location: text("location").notNull(),
    partnerCode: text("partner_code"),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("document_ledger_entries_id_uuid", sql.raw(uuidCheckPredicate("id"))),index("idx_documents_expires_on").on(table.expiresOn)],
)

export type DocumentRow = InferSelectModel<typeof documents>
