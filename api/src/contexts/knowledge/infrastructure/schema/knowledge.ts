import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** ナレッジ記事（社内手続き・規程などの記事） */
export const knowledgeArticles = sqliteTable(
  "knowledge_articles",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    tags: text("tags"),
    bodyMd: text("body_md").notNull(),
    authorId: text("author_id").$type<EmployeeId>().notNull(),
    createdAt: text("created_at").notNull(),
    revision: integer("revision").notNull().default(1),
    status: text("status", { enum: ["active", "withdrawn"] })
      .notNull()
      .default("active"),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("knowledge_articles_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type KnowledgeArticleRow = InferSelectModel<typeof knowledgeArticles>
