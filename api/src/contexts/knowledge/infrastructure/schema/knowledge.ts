import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** ナレッジ記事（社内手続き・規程などの記事） */
export const knowledgeArticles = sqliteTable(
  "knowledge_articles",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    tags: text("tags"),
    bodyMd: text("body_md").notNull(),
    authorId: text("author_id").$type<EmployeeId>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  () => [check("knowledge_articles_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type KnowledgeArticleRow = InferSelectModel<typeof knowledgeArticles>
