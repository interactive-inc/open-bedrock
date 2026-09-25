import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 文書台帳（契約書・許認可などのメタデータ台帳。本体ファイルは持たず所在のみ記録する）。 */
export const documents = sqliteTable(
  "document_ledger_entries",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    category: text("category"),
    location: text("location").notNull(),
    counterpartyReference: text("counterparty_reference"),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("document_ledger_entries_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_documents_expires_on").on(table.expiresOn),
  ],
)

export type DocumentRow = InferSelectModel<typeof documents>
