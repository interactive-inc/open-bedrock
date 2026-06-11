import type { KnowledgeArticle } from "@/domain/knowledge/knowledge-article"
import type { Context } from "@/env"
import { KnowledgeArticleRepository } from "@/infrastructure/knowledge/knowledge-article-repository"

export type Command = {
  articleId: number
  authorId: number
  title: string
  category: string
  tags: string | null
  bodyMd: string
}

export type ArticleNotFound = { reason: "article_not_found" }

export type NotAuthor = { reason: "not_author" }

/**
 * ナレッジ記事の表題・カテゴリ・タグ・本文を更新する。作成者以外の更新を拒否する。
 */
export class UpdateKnowledgeArticle {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<KnowledgeArticle | ArticleNotFound | NotAuthor | Error> {
    const articleRepository = new KnowledgeArticleRepository(this.c)

    const current = await articleRepository.findById(command.articleId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "article_not_found" }
    }

    if (current.authorId !== command.authorId) {
      return { reason: "not_author" }
    }

    const updated = current.withContent({
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
    })

    const result = await articleRepository.update(updated)

    if (result === null) {
      return { reason: "article_not_found" as const }
    }

    return result
  }
}
