import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 社内アナウンス（全社お知らせ。draft→published→archived の状態を持つ）。 */
export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    publishedOn: text("published_on"),
    authorEmployeeId: text("author_employee_id").$type<EmployeeId>().notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_announcements_status").on(table.status),
    check("announcements_id_uuid", sql.raw(uuidCheckPredicate("id"))),
  ],
)

export type AnnouncementRow = InferSelectModel<typeof announcements>
