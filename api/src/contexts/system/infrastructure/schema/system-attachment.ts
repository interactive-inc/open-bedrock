import type { AttachmentStatus } from "@system/domain/values/attachment-status.definition"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * 添付のメタデータ。本体は object storage に暗号文で置き、この行が復号鍵と所在を持つ。
 *
 * owner は accountId（System は Employee を知らない）。ファイル名はそれ自体が個人情報に
 * なり得るため object key には含めず、この行だけが保持する。wrappedDek を NULL にすると
 * 原本・レプリカ・全バックアップ世代の暗号文が復号不能になる（crypto-shredding）。
 */
export const systemAttachments = sqliteTable(
  "system_attachments",
  {
    id: text("id").primaryKey(),
    ownerAccountId: text("owner_account_id").notNull(),
    objectKey: text("object_key").notNull().unique(),
    status: text("status").notNull().$type<AttachmentStatus>(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    fileName: text("file_name").notNull(),
    plaintextSha256: text("plaintext_sha256").notNull(),
    wrappedDek: text("wrapped_dek"),
    wrappedDekIv: text("wrapped_dek_iv"),
    contentIv: text("content_iv").notNull(),
    kekVersion: integer("kek_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }),
    erasedAt: integer("erased_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_system_attachments_owner_status").on(table.ownerAccountId, table.status),
    index("idx_system_attachments_created_at").on(table.createdAt),
    check(
      "system_attachments_status",
      sql`${table.status} IN ('uploading', 'pending', 'linked', 'erased')`,
    ),
    check("system_attachments_byte_size", sql`${table.byteSize} > 0`),
    check("system_attachments_kek_version", sql`${table.kekVersion} > 0`),
    check(
      "system_attachments_object_key",
      sql`${table.objectKey} LIKE 'att/%' AND length(${table.objectKey}) <= 255`,
    ),
    check(
      "system_attachments_erased_key",
      sql`(${table.status} = 'erased') = (${table.wrappedDek} IS NULL)`,
    ),
  ],
)

export type SystemAttachmentRow = InferSelectModel<typeof systemAttachments>

export const systemAttachmentSchema = {
  systemAttachments,
}
