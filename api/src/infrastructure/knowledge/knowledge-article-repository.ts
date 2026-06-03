import { KnowledgeArticle } from "@/domain/knowledge/knowledge-article"
import type { Context } from "@/env"
import { knowledgeArticles } from "@/schema"
import { eq } from "drizzle-orm"

export class KnowledgeArticleRepository {
  constructor(private readonly c: Context) {}

  // 記事 id で1件取得する。存在しなければ null。
  async findById(id: number): Promise<KnowledgeArticle | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(knowledgeArticles)
        .where(eq(knowledgeArticles.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : KnowledgeArticle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load knowledge_article")
    }
  }

  async create(article: KnowledgeArticle): Promise<KnowledgeArticle | Error> {
    try {
      const rows = await this.c.var.database
        .insert(knowledgeArticles)
        .values({
          title: article.title,
          category: article.category,
          tags: article.tags,
          bodyMd: article.bodyMd,
          authorId: article.authorId,
          createdAt: article.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert knowledge_article")
        : KnowledgeArticle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert knowledge_article")
    }
  }

  // 記事の表題・カテゴリ・タグ・本文を更新する。
  async update(article: KnowledgeArticle): Promise<KnowledgeArticle | Error> {
    try {
      if (article.id === null) {
        return new Error("cannot update unsaved knowledge_article")
      }

      const rows = await this.c.var.database
        .update(knowledgeArticles)
        .set({
          title: article.title,
          category: article.category,
          tags: article.tags,
          bodyMd: article.bodyMd,
        })
        .where(eq(knowledgeArticles.id, article.id))
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to update knowledge_article")
        : KnowledgeArticle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update knowledge_article")
    }
  }

  // 記事を削除する。
  async delete(id: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete knowledge_article")
    }
  }
}
