import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 社内アナウンス（全社お知らせ。draft→published→archived の状態を持つ）。 */
export const announcements = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    publishedOn: text("published_on"),
    authorEmployeeId: integer("author_employee_id").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_announcements_status").on(table.status)],
)

export type AnnouncementRow = InferSelectModel<typeof announcements>
