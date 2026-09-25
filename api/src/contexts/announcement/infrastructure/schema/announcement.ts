import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 社内アナウンス（全社お知らせ。draft→published→archived の状態を持つ）。 */
export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    publishedOn: text("published_on"),
    authorEmployeeId: text("author_employee_id").$type<EmployeeId>().notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("announcements_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_announcements_status").on(table.status),
  ],
)

export type AnnouncementRow = InferSelectModel<typeof announcements>
